import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";

const app = express();

app.use(express.json());
app.use(cors());

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
// 📲 LEADS (PUSH)
// ==============================
const leadSchema = new mongoose.Schema({
  email: String,
  token: { type: String, required: true },
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
// 📥 REGISTER
// ==============================
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    res.json({
      id: user._id,
      email: user.email
    });

  } catch (error) {
    console.error("ERRO REGISTER:", error);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

// ==============================
// 📲 SAVE TOKEN (🔥 NOVO)
// ==============================
app.post("/save-token", async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token é obrigatório" });
    }

    // evita duplicado
    const existing = await Lead.findOne({ token });

    if (existing) {
      return res.json({ message: "Token já salvo" });
    }

    const lead = await Lead.create({
      token,
      email
    });

    res.json({
      message: "Token salvo com sucesso",
      lead
    });

  } catch (error) {
    console.error("❌ ERRO SAVE TOKEN:", error);
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ==============================
// 🚀 START
// ==============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
