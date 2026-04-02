// ================================
// IMPORTS
// ================================
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
require("dotenv").config();

// ================================
// APP
// ================================
const app = express();
app.use(cors());
app.use(express.json());

// ================================
// FIREBASE ADMIN
// ================================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================================
// MONGODB
// ================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo conectado"))
  .catch(err => console.error("Erro Mongo:", err));

// ================================
// MODELS
// ================================
const UserSchema = new mongoose.Schema({
  nome: String,
  email: { type: String, unique: true },
  senha: String
});

const TokenSchema = new mongoose.Schema({
  token: String
});

const User = mongoose.model("User", UserSchema);
const Token = mongoose.model("Token", TokenSchema);

// ================================
// JWT MIDDLEWARE
// ================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ================================
// REGISTER (CORRIGIDO)
// ================================
app.post("/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    const hash = await bcrypt.hash(senha, 10);

    const user = await User.create({
      nome,
      email,
      senha: hash
    });

    res.json({
      success: true,
      user
    });

  } catch (err) {
    console.error("Erro no register:", err);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

// ================================
// LOGIN
// ================================
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const match = await bcrypt.compare(senha, user.senha);

    if (!match) {
      return res.status(400).json({ error: "Senha inválida" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: "Erro no login" });
  }
});

// ================================
// SAVE TOKEN (FIREBASE)
// ================================
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

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar token" });
  }
});

// ================================
// 🚀 SEND PUSH GLOBAL
// ================================
app.post("/send", authMiddleware, async (req, res) => {
  try {
    const { titulo, mensagem } = req.body;

    if (!titulo || !mensagem) {
      return res.status(400).json({ error: "Título e mensagem obrigatórios" });
    }

    const tokensDB = await Token.find({});

    if (!tokensDB.length) {
      return res.json({
        success: true,
        enviados: 0,
        message: "Nenhum token cadastrado"
      });
    }

    const tokens = tokensDB.map(t => t.token);

    console.log("📦 Tokens encontrados:", tokens.length);

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: titulo,
        body: mensagem
      }
    });

    console.log("📊 Resultado Firebase:", response);

    res.json({
      success: true,
      enviados: response.successCount,
      falhas: response.failureCount
    });

  } catch (err) {
    console.error("Erro envio:", err);
    res.status(500).json({ error: "Erro ao enviar push" });
  }
});

// ================================
// START SERVER
// ================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});
