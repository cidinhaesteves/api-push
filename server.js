import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import admin from "firebase-admin";

const app = express();

app.use(express.json());
app.use(cors());

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
  token: { type: String, required: true },
  segment: { type: String, default: "geral" },
  createdAt: { type: Date, default: Date.now }
});

const Lead = mongoose.model("Lead", leadSchema);

// ==============================
// 🚀 TESTE
// ==============================
app.get("/", (req, res) => {
  res.send("🚀 API PUSH ONLINE");
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

    const existing = await Lead.findOne({ token });

    if (existing) {
      return res.json({ message: "Token já salvo" });
    }

    const lead = await Lead.create({
      token,
      segment: segment || "geral"
    });

    res.json({ message: "Token salvo", lead });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ==============================
// 📤 SEND PUSH (🔥 CORE)
// ==============================
app.post("/send-push", async (req, res) => {
  try {
    const { title, body, segment } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Título e mensagem obrigatórios" });
    }

    // 🔍 FILTRO
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
