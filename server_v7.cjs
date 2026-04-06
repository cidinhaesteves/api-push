const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// ================================
// MONGODB
// ================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log("Erro Mongo:", err));

// ================================
// MODEL USER
// ================================
const User = mongoose.model("User", {
  email: String,
  senha: String
});

// ================================
// LOGIN (CORRIGIDO)
// ================================
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    // 🔒 validação básica
    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const user = await User.findOne({ email });

    // 🔒 VERIFICA SE USUÁRIO EXISTE
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // 🔒 VERIFICA SE SENHA EXISTE
    if (!user.senha) {
      return res.status(500).json({ error: "Senha inválida no banco" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ================================
app.get("/", (req, res) => {
  res.send("API PUSH ONLINE 🚀");
});

// ================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
