import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import mongoose from "mongoose";
import cors from "cors";

const app = express();

app.use(cors());
app.use(bodyParser.json());

// 🔐 FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// 💾 MONGODB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.log("❌ Erro MongoDB:", err));

// =============================
// 📦 MODELS
// =============================

// 🔔 TOKENS
const tokenSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const Token = mongoose.model("Token", tokenSchema);

// 👤 USERS
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  tokens: [String],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);

// 🧠 GROUPS (NOVO)
const groupSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  users: [String], // lista de userId
  createdAt: { type: Date, default: Date.now }
});
const Group = mongoose.model("Group", groupSchema);

// =============================
// 🧠 FALLBACK MEMÓRIA
// =============================
let tokens = [];

// =============================
// 📥 SAVE TOKEN (ANTIGO)
// =============================
app.post("/save-token", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token inválido" });
  }

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  try {
    await Token.updateOne({ token }, { token }, { upsert: true });
  } catch {}

  res.json({ success: true });
});

// =============================
// 🚀 SEND GLOBAL (ANTIGO)
// =============================
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    let dbTokens = [];

    try {
      const data = await Token.find();
      dbTokens = data.map(t => t.token);
    } catch {}

    const allTokens = dbTokens.length > 0 ? dbTokens : tokens;

    for (const token of allTokens) {
      try {
        await admin.messaging().send({
          token,
          notification: { title: titulo, body: mensagem },
        });
      } catch {}
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================
// 👤 REGISTER USER
// =============================
app.post("/register-user", async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: "userId e token obrigatórios" });
  }

  try {
    const user = await User.findOne({ userId });

    if (!user) {
      await User.create({
        userId,
        tokens: [token],
      });
    } else {
      if (!user.tokens.includes(token)) {
        user.tokens.push(token);
        await user.save();
      }
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================
// 🚀 SEND TO USER
// =============================
app.post("/send-to-user", async (req, res) => {
  const { userId, titulo, mensagem } = req.body;

  try {
    const user = await User.findOne({ userId });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const tokensInvalidos = [];

    for (const token of user.tokens) {
      try {
        await admin.messaging().send({
          token,
          notification: { title: titulo, body: mensagem },
        });
      } catch {
        tokensInvalidos.push(token);
      }
    }

    user.tokens = user.tokens.filter(t => !tokensInvalidos.includes(t));
    await user.save();

    res.json({
      success: true,
      enviados: user.tokens.length,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================
// 🚀 START
// =============================
app.listen(10000, () => {
  console.log("🚀 server-v4 rodando");
});
