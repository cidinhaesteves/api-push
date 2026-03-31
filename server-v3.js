import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import mongoose from "mongoose";

const app = express();
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

// 📦 MODEL
const tokenSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Token = mongoose.model("Token", tokenSchema);

// 🧠 FALLBACK EM MEMÓRIA (mantém compatibilidade)
let tokens = [];

// 📥 SALVAR TOKEN
app.post("/save-token", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token inválido" });
  }

  // memória (continua funcionando como antes)
  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  // banco (novo)
  try {
    await Token.updateOne(
      { token },
      { token },
      { upsert: true }
    );

    console.log("📱 Token salvo (MongoDB):", token);

  } catch (err) {
    console.log("⚠️ Erro ao salvar no Mongo:", err.message);
  }

  res.json({ success: true });
});

// 🚀 ENVIAR PUSH
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    if (!titulo || !mensagem) {
      throw new Error("Título e mensagem são obrigatórios");
    }

    // 🔥 BUSCAR TOKENS DO BANCO
    let dbTokens = [];

    try {
      const data = await Token.find();
      dbTokens = data.map(t => t.token);
    } catch (err) {
      console.log("⚠️ Erro ao buscar tokens do Mongo");
    }

    // fallback: se banco falhar, usa memória
    const allTokens = dbTokens.length > 0 ? dbTokens : tokens;

    if (allTokens.length === 0) {
      throw new Error("Nenhum token cadastrado");
    }

    const tokensInvalidos = [];

    for (const token of allTokens) {
      try {
        await admin.messaging().send({
          token,
          notification: {
            title: titulo,
            body: mensagem,
          },
        });
      } catch (error) {
        console.log("❌ Token inválido:", token);
        tokensInvalidos.push(token);
      }
    }

    // 🧹 LIMPEZA NO BANCO
    if (tokensInvalidos.length > 0) {
      try {
        await Token.deleteMany({ token: { $in: tokensInvalidos } });
        console.log("🧹 Tokens removidos do Mongo:", tokensInvalidos.length);
      } catch (err) {
        console.log("⚠️ Erro ao limpar Mongo");
      }
    }

    // 🧹 LIMPEZA NA MEMÓRIA
    tokens = tokens.filter(t => !tokensInvalidos.includes(t));

    console.log("📊 Tokens ativos:", allTokens.length);

    res.json({
      success: true,
      enviados: allTokens.length,
      removidos: tokensInvalidos.length
    });

  } catch (error) {
    console.error("❌ Erro geral:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🚀 START
app.listen(10000, () => {
  console.log("🚀 Rodando na porta 10000");
});
