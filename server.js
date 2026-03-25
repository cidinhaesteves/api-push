import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// ===============================
// CONFIG
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// MONGODB CONNECTION (CORRIGIDO)
// ===============================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.log("❌ ERRO: MONGO_URI não encontrada no ambiente");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado com sucesso"))
  .catch((err) => {
    console.log("❌ Erro ao conectar no MongoDB:", err);
    process.exit(1);
  });

// ===============================
// MODEL
// ===============================
const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true }
});

const Token = mongoose.model("Token", tokenSchema);

// ===============================
// ROUTES
// ===============================

// teste
app.get("/", (req, res) => {
  res.send("🚀 API PUSH ONLINE");
});

// salvar token
app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token não enviado" });
    }

    await Token.updateOne(
      { token },
      { token },
      { upsert: true }
    );

    console.log("✅ Token salvo no MongoDB");

    res.status(200).json({ message: "Token salvo com sucesso" });

  } catch (error) {
    console.log("❌ Erro ao salvar token:", error);
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ===============================
// SERVER
// ===============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});