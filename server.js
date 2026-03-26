import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import cron from "node-cron";

const app = express();

app.use(express.json());
app.use(cors());

// ==============================
// 🔐 JWT SECRET
// ==============================
const JWT_SECRET = "SUA_CHAVE_SUPER_SECRETA";

// ==============================
// 🔥 FIREBASE
// ==============================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ==============================
// 🔌 MONGODB
// ==============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error("❌ Mongo erro:", err));

// ==============================
// 👤 USER
// ==============================
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
});

const User = mongoose.model("User", userSchema);

// ==============================
// 📲 LEADS
// ==============================
const leadSchema = new mongoose.Schema({
  token: { type: String, required: true },
  segment: { type: String, default: "geral" },
  createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.model("Lead", leadSchema);

// ==============================
// 📊 NOTIFICATIONS (HISTÓRICO)
// ==============================
const notificationSchema = new mongoose.Schema({
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);

// ==============================
// 📅 SCHEDULE
// ==============================
const scheduleSchema = new mongoose.Schema({
  title: String,
  body: String,
  segment: String,
  sendAt: Date,
  sent: { type: Boolean, default: false },
  executedAt: Date
});

const Schedule = mongoose.model("Schedule", scheduleSchema);

// ==============================
// 🔐 AUTH
// ==============================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ==============================
// 🚀 TESTE
// ==============================
app.get("/", (req, res) => {
  res.send("🚀 API PUSH ONLINE");
});

// ==============================
// 📥 REGISTER
// ==============================
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    res.json(user);

  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

// ==============================
// 🔐 LOGIN
// ==============================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.password) {
      return res.status(400).json({ error: "Usuário inválido" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Senha inválida" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (error) {
    console.error("❌ ERRO LOGIN:", error);
    res.status(500).json({ error: "Erro no login" });
  }
});

// ==============================
// 📲 SAVE TOKEN
// ==============================
app.post("/save-token", async (req, res) => {
  try {
    const { token, segment } = req.body;

    const exists = await Lead.findOne({ token });

    if (exists) {
      return res.json({ message: "Token já salvo" });
    }

    const lead = await Lead.create({
      token,
      segment: segment || "geral"
    });

    res.json({ message: "Token salvo", lead });

  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ==============================
// 📤 FUNÇÃO ENVIO
// ==============================
async function sendPush({ title, body, segment }) {

  const filter = segment && segment !== "all"
    ? { segment }
    : {};

  const leads = await Lead.find(filter);
  const tokens = leads.map(l => l.token);

  if (tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    tokens
  });

  // 🔥 SALVA HISTÓRICO
  await Notification.create({ title, body });

  console.log("🚀 Push enviado:", title);
}

// ==============================
// 📤 SEND PUSH
// ==============================
app.post("/send-push", auth, async (req, res) => {
  try {
    await sendPush(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ ERRO PUSH:", error);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ==============================
// 📅 AGENDAR
// ==============================
app.post("/schedule", auth, async (req, res) => {
  try {
    const { title, body, sendAt, segment } = req.body;

    await Schedule.create({
      title,
      body,
      segment,
      sendAt: new Date(sendAt)
    });

    res.json({ success: true });

  } catch (error) {
    console.error("❌ ERRO AGENDAR:", error);
    res.status(500).json({ error: "Erro ao agendar" });
  }
});

// ==============================
// 📅 LISTAR AGENDAMENTOS
// ==============================
app.get("/schedules", auth, async (req, res) => {
  const data = await Schedule.find().sort({ sendAt: -1 });
  res.json(data);
});

// ==============================
// ❌ CANCELAR AGENDAMENTO
// ==============================
app.delete("/schedule/:id", auth, async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao cancelar" });
  }
});

// ==============================
// 📊 HISTÓRICO (NOVO 🔥)
// ==============================
app.get("/notifications", auth, async (req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 });
  res.json(data);
});

// ==============================
// ⏰ CRON (BRASIL)
// ==============================
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const nowBR = new Date(now.getTime() - (3 * 60 * 60 * 1000));

    const schedules = await Schedule.find({
      sendAt: { $lte: nowBR },
      sent: false
    });

    for (const item of schedules) {
      await sendPush(item);

      item.sent = true;
      item.executedAt = new Date();
      await item.save();

      console.log("⏰ Executado:", item.title);
    }

  } catch (error) {
    console.error("❌ ERRO CRON:", error);
  }
});

// ==============================
// 👑 ADMIN AUTO
// ==============================
async function createAdmin() {
  const email = "admin@email.com";
  const password = "123456";

  const exists = await User.findOne({ email });

  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, password: hash });
    console.log("✅ Admin criado");
  } else {
    console.log("ℹ️ Admin já existe");
  }
}

mongoose.connection.once("open", () => createAdmin());

// ==============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
