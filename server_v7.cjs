const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// ================================
// FIREBASE
// ================================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================================
// MONGO
// ================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log("Erro Mongo:", err));

// ================================
// MODELS
// ================================
const User = mongoose.model("User", {
  email: String,
  senha: String
});

const Token = mongoose.model("Token", {
  token: String
});

// ================================
// LOGIN
// ================================
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
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
    console.error("Erro login:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ================================
// AUTH
// ================================
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) return res.status(401).json({ error: "Sem token" });

  const token = header.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ================================
// SAVE TOKEN
// ================================
app.post("/save-token", auth, async (req, res) => {
  try {
    const { token } = req.body;

    await Token.create({ token });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ================================
// SEND GLOBAL
// ================================
app.post("/send-global", auth, async (req, res) => {
  try {
    const { title, body } = req.body;

    const tokens = await Token.find();

    const messages = tokens.map(t => ({
      notification: { title, body },
      token: t.token
    }));

    const results = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    res.json({
      success: true,
      enviados: results.length
    });

  } catch (err) {
    console.error("Erro send-global:", err);
    res.status(500).json({ error: "Erro ao enviar push" });
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
