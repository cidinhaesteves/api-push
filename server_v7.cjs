const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

// =======================
// 🔥 FIREBASE ADMIN
// =======================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// =======================
// 🔥 MONGODB
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log(err));

// =======================
// 📦 MODELS
// =======================
const TokenSchema = new mongoose.Schema({
  token: String,
  userId: String,
  group: String
});

const Token = mongoose.model("Token", TokenSchema);

const UserSchema = new mongoose.Schema({
  nome: String,
  email: { type: String, unique: true },
  senha: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

// =======================
// 🔐 MIDDLEWARE AUTH
// =======================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================
// 🔐 REGISTER
// =======================
app.post("/register", async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const hash = await bcrypt.hash(senha, 10);

    const user = new User({
      nome,
      email,
      senha: hash
    });

    await user.save();

    res.json({ message: "Usuário criado com sucesso" });
  } catch (err) {
    res.status(400).json({ error: "Erro ao registrar usuário" });
  }
});

// =======================
// 🔐 LOGIN
// =======================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const isMatch = await bcrypt.compare(senha, user.senha);

    if (!isMatch) {
      return res.status(400).json({ error: "Senha inválida" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Erro no login" });
  }
});

// =======================
// 💾 SAVE TOKEN
// =======================
app.post("/save-token", async (req, res) => {
  const { token, userId, group } = req.body;

  try {
    await Token.create({ token, userId, group });
    res.json({ message: "Token salvo" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// =======================
// 🚀 SEND GLOBAL (PROTEGIDO)
// =======================
app.post("/send", auth, async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    const tokens = await Token.find();

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      notification: {
        title: titulo,
        body: mensagem
      }
    });

    res.json({
      success: true,
      enviados: response.successCount
    });
  } catch (err) {
    res.status(500).json({ error: "Erro no envio" });
  }
});

// =======================
// 🚀 SEND TO USER (PROTEGIDO)
// =======================
app.post("/send-to-user", auth, async (req, res) => {
  const { userId, titulo, mensagem } = req.body;

  try {
    const tokens = await Token.find({ userId });

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      notification: {
        title: titulo,
        body: mensagem
      }
    });

    res.json({
      success: true,
      enviados: response.successCount
    });
  } catch (err) {
    res.status(500).json({ error: "Erro no envio por usuário" });
  }
});

// =======================
// 🚀 SEND TO GROUP (PROTEGIDO)
// =======================
app.post("/send-to-group", auth, async (req, res) => {
  const { group, titulo, mensagem } = req.body;

  try {
    const tokens = await Token.find({ group });

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      notification: {
        title: titulo,
        body: mensagem
      }
    });

    res.json({
      success: true,
      enviados: response.successCount
    });
  } catch (err) {
    res.status(500).json({ error: "Erro no envio por grupo" });
  }
});

// =======================
// 🚀 START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
