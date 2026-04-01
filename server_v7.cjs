const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   🔥 FIREBASE ADMIN
========================= */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* =========================
   💾 MONGODB
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log(err));

/* =========================
   📦 MODELS
========================= */

// USERS
const UserSchema = new mongoose.Schema({
  nome: String,
  email: String,
  senha: String,
});

const User = mongoose.model("User", UserSchema);

// TOKENS
const TokenSchema = new mongoose.Schema({
  token: String,
});

const Token = mongoose.model("Token", TokenSchema);

/* =========================
   🔐 AUTH MIDDLEWARE
========================= */
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Token não enviado" });
  }

  try {
    jwt.verify(token, "segredo");
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* =========================
   👤 REGISTER
========================= */
app.post("/register", async (req, res) => {
  const { nome, email, senha } = req.body;

  const hash = await bcrypt.hash(senha, 10);

  const user = new User({
    nome,
    email,
    senha: hash,
  });

  await user.save();

  res.json({ message: "Usuário criado com sucesso" });
});

/* =========================
   🔑 LOGIN
========================= */
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: "Usuário não encontrado" });
  }

  const valid = await bcrypt.compare(senha, user.senha);

  if (!valid) {
    return res.status(400).json({ error: "Senha inválida" });
  }

  const token = jwt.sign({ id: user._id }, "segredo");

  res.json({ token });
});

/* =========================
   💾 SAVE TOKEN (SEM DUPLICAR)
========================= */
app.post("/save-token", async (req, res) => {
  const { token } = req.body;

  await Token.updateOne(
    { token },
    { token },
    { upsert: true }
  );

  res.json({ message: "Token salvo" });
});

/* =========================
   🚀 SEND PUSH (CORRIGIDO)
========================= */
app.post("/send", auth, async (req, res) => {
  const { titulo, mensagem } = req.body;

  const tokens = await Token.find();

  const registrationTokens = tokens.map(t => t.token);

  if (registrationTokens.length === 0) {
    return res.json({ success: false, message: "Nenhum token encontrado" });
  }

  const message = {
    data: {
      title: titulo,
      body: mensagem,
    },
    tokens: registrationTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: true,
      enviados: response.successCount,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

/* =========================
   🌐 ROOT
========================= */
app.get("/", (req, res) => {
  res.send("API PUSH ONLINE 🚀");
});

/* =========================
   🚀 START
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
