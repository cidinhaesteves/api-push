import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";

const app = express();

// 🔥 ESSENCIAL
app.use(express.json());
app.use(cors());

// ===============================
// 🔌 CONEXÃO MONGODB
// ===============================
mongoose.connect("COLE_SUA_STRING_MONGO_AQUI")
.then(() => console.log("✅ MongoDB conectado com sucesso"))
.catch(err => console.log("❌ Erro Mongo:", err));

// ===============================
// 👤 MODEL USER
// ===============================
const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

const User = mongoose.model("User", userSchema);

// ===============================
// 🚀 ROTA TESTE
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 API PUSH ONLINE");
});

// ===============================
// 📝 REGISTER
// ===============================
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
