import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();

app.use(cors());
app.use(express.json());

// ============================
// CONFIG
// ============================

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = "123456"; // pode melhorar depois

// ============================
// MONGO
// ============================

if (!MONGO_URI) {
  console.log("❌ MONGO_URI não encontrada");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.log("❌ Erro MongoDB:", err));

// ============================
// MODELS
// ============================

const tokenSchema = new mongoose.Schema({
  token: String,
});

const Token = mongoose.model("Token", tokenSchema);

// ============================
// LOGIN FIXO (SIMPLES)
// ============================

const USER = {
  email: "admin@email.com",
  password: "123456"
};

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === USER.email && password === USER.password) {
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({ token });
  }

  return res.status(401).json({ error: "Login inválido" });
});

// ============================
// SAVE TOKEN
// ============================

app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;

    await Token.updateOne(
      { token },
      { token },
      { upsert: true }
    );

    console.log("✅ Token salvo");

    res.status(200).json({ message: "ok" });

  } catch (error) {
    console.log("❌ Erro:", error);
    res.status(500).json({ error: "Erro" });
  }
});

// ============================
// TESTE
// ============================

app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// ============================
// SERVER
// ============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
