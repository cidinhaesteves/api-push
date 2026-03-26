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

const JWT_SECRET = "SUA_CHAVE_SUPER_SECRETA";

// ================= FIREBASE =================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error(err));

// ================= MODELS =================
const User = mongoose.model("User", {
  email: String,
  password: String
});

const Lead = mongoose.model("Lead", {
  token: String,
  segment: String
});

const Notification = mongoose.model("Notification", {
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now }
});

// 🔥 AGENDAMENTOS
const Schedule = mongoose.model("Schedule", {
  title: String,
  body: String,
  segment: String,
  sendAt: Date,
  sent: { type: Boolean, default: false },
  executedAt: Date
});

// ================= AUTH =================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;
    const decoded = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ================= LOGIN =================
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
      { id: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error("❌ ERRO LOGIN:", err);
    res.status(500).json({ error: "Erro no login" });
  }
});

// ================= SAVE TOKEN =================
app.post("/save-token", async (req, res) => {
  const { token, segment } = req.body;

  const exists = await Lead.findOne({ token });

  if (!exists) {
    await Lead.create({ token, segment });
  }

  res.json({ ok: true });
});

// ================= FUNÇÃO ENVIO =================
async function sendPush({ title, body, segment }) {
  const filter = segment && segment !== "all" ? { segment } : {};
  const leads = await Lead.find(filter);

  const tokens = leads.map(l => l.token);

  if (tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    tokens
  });

  await Notification.create({
    title,
    body
  });

  console.log("🚀 Push enviado:", title);
}

// ================= ENVIO MANUAL =================
app.post("/send-push", auth, async (req, res) => {
  try {
    await sendPush(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ ERRO PUSH:", err);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ================= AGENDAR =================
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

  } catch (err) {
    console.error("❌ ERRO AGENDAR:", err);
    res.status(500).json({ error: "Erro ao agendar" });
  }
});

// ================= LISTAR AGENDAMENTOS =================
app.get("/schedules", auth, async (req, res) => {
  const data = await Schedule.find().sort({ sendAt: 1 });
  res.json(data);
});

// ================= CANCELAR AGENDAMENTO =================
app.delete("/schedule/:id", auth, async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao cancelar" });
  }
});

// ================= CRON (HORÁRIO BRASIL 🔥) =================
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // 🔥 Ajuste UTC-3 (Brasil)
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

      console.log("⏰ Push automático enviado:", item.title);
    }

  } catch (err) {
    console.error("❌ ERRO CRON:", err);
  }
});

// ================= ADMIN AUTO =================
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

// ================= START =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
