import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

const app = express();

app.use(express.json());
app.use(cors());

// ==============================
// 🔐 CONFIG JWT
// ==============================
const JWT_SECRET = process.env.JWT_SECRET || "segredo_super_forte";

// ==============================
// 🔥 FIREBASE ADMIN
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
// 🔐 MIDDLEWARE AUTH
// ==============================
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
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
// 👤 REGISTER
// ==============================
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hash
  });

  res.json(user);
});

// ==============================
// 🔐 LOGIN
// ==============================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: "Usuário não encontrado" });
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
});

// ==============================
// 📲 SAVE TOKEN
// ==============================
app.post("/save-token", async (req, res) => {
  const { token, segment } = req.body;

  const exists = await Lead.findOne({ token });

  if (exists) {
    return res.json({ message: "Token já existe" });
  }

  await Lead.create({
    token,
    segment: segment || "geral"
  });

  res.json({ message: "Token salvo" });
});

// ==============================
// 📤 SEND PUSH (PROTEGIDO 🔐)
// ==============================
app.post("/send-push", auth, async (req, res) => {
  try {
    const { title, body, segment } = req.body;

    const filter = segment && segment !== "all"
      ? { segment }
      : {};

    const leads = await Lead.find(filter);

    const tokens = leads.map(l => l.token);

    const message = {
      notification: { title, body },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: true,
      total: tokens.length,
      sent: response.successCount,
      failed: response.failureCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ==============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
