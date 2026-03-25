import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";

const app = express();

// 🔥 ESSENCIAL
app.use(express.json());
app.use(cors());

// ==============================
// 🔌 CONEXÃO MONGODB
// ==============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado com sucesso"))
  .catch(err => console.log("❌ Erro ao conectar MongoDB:", err));

// ==============================
// 📦 MODEL USER
// ==============================
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
});

const User = mongoose.model("User", userSchema);

// ==============================
// 🚀 ROTA TESTE
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

    // validação básica
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    // verifica se já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    // hash senha
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    res.json(user);

  } catch (error) {
    console.error("ERRO REGISTER:", error);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

// ==============================
// 🚀 START SERVER
// ==============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
