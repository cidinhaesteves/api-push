import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";

const app = express();

app.use(express.json());
app.use(cors());

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
  token: String,
  segment: { type: String, default: "geral" },
  createdAt: { type: Date, default: Date.now }
});
const Lead = mongoose.model("Lead", leadSchema);

// ==============================
// 🧾 HISTÓRICO (NOVO 🔥)
// ==============================
const notificationSchema = new mongoose.Schema({
  title: String,
  body: String,
  segment: String,
  total: Number,
  sent: Number,
  failed: Number,
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);

// ==============================
// 🔐 AUTH
// ==============================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "Token não enviado" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ==============================
// LOGIN
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

    const token = jwt.sign({ id: user._id }, JWT_SECRET);

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
});

// ==============================
// SAVE TOKEN
// ==============================
app.post("/save-token", async (req, res) => {
  const { token, segment } = req.body;

  const exists = await Lead.findOne({ token });

  if (exists) return res.json({ message: "Já existe" });

  await Lead.create({ token, segment });

  res.json({ message: "Salvo" });
});

// ==============================
// 🚀 SEND PUSH (COM HISTÓRICO)
// ==============================
app.post("/send-push", authMiddleware, async (req, res) => {
  try {
    const { title, body, segment } = req.body;

    const filter = segment && segment !== "all" ? { segment } : {};
    const leads = await Lead.find(filter);

    const tokens = leads.map(l => l.token);

    const response = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      tokens
    });

    // 🔥 SALVAR HISTÓRICO
    await Notification.create({
      title,
      body,
      segment,
      total: tokens.length,
      sent: response.successCount,
      failed: response.failureCount
    });

    res.json({
      success: true,
      total: tokens.length,
      sent: response.successCount,
      failed: response.failureCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

// ==============================
// 📊 BUSCAR HISTÓRICO
// ==============================
app.get("/notifications", authMiddleware, async (req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 });
  res.json(data);
});

// ==============================
// 👤 ADMIN AUTO
// ==============================
async function createAdmin() {
  const email = "admin@email.com";
  const password = "123456";

  const exists = await User.findOne({ email });

  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, password: hash });
    console.log("✅ Admin criado");
  }
}

mongoose.connection.once("open", () => createAdmin());

// ==============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Rodando"));
