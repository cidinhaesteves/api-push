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
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    res.json(user);

  } catch (error) {
    console.error(error);
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

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro no login" });
  }
});

// ==============================
// 📲 SAVE TOKEN
// ==============================
app.post("/save-token", async (req, res) => {
  try {
    const { token, segment } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token obrigatório" });
    }

    const exists = await Lead.findOne({ token });

    if (exists) {
      return res.json({ message: "Token já existe" });
    }

    await Lead.create({
      token,
      segment: segment || "geral"
    });

    res.json({ message: "Token salvo" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ==============================
// 📤 SEND PUSH (PROTEGIDO 🔐)
// ==============================
app.post("/send-push", auth, async (req, res) => {
  try {
    const { title, body, segment } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Título e mensagem obrigatórios" });
    }

    const filter = segment && segment !== "all"
      ? { segment }
      : {};

    const leads = await Lead.find(filter);

    if (leads.length === 0) {
      return res.json({ message: "Nenhum usuário encontrado" });
    }

    const tokens = leads.map(l => l.token);

    const message = {
      notification: {
        title,
        body
      },
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
    console.error("❌ ERRO PUSH:", error);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ==============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
