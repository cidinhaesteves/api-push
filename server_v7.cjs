require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FIREBASE ================= */

// 👉 USA JSON COMPLETO DO RENDER
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.log(err));

/* ================= MODELS ================= */

const User = mongoose.model("User", new mongoose.Schema({
  email: String,
  password: String,
}));

const Token = require("./models/Token");

/* ================= AUTH ================= */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const user = new User({ email, password: hash });
  await user.save();

  res.json({ message: "Usuário criado" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(401).json({ error: "Senha inválida" });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token });
});

/* ================= SALVAR TOKEN ================= */

app.post("/save-token", async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(
      req.headers.authorization.split(" ")[1],
      process.env.JWT_SECRET
    );

    const email = decoded.email;

    if (!token) {
      return res.status(400).json({ error: "Token ausente" });
    }

    await Token.findOneAndUpdate(
      { token },
      { email, token },
      { upsert: true }
    );

    res.json({ message: "Token salvo com sucesso" });

  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "JWT inválido" });
  }
});

/* ================= ENVIO GLOBAL ================= */

app.post("/send-global", async (req, res) => {
  try {
    const { title, body } = req.body;

    const tokens = await Token.find();

    const message = {
      notification: { title, body },
      tokens: tokens.map(t => t.token),
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no envio global" });
  }
});

/* ================= ENVIO POR EMAIL ================= */

app.post("/send-to-user", async (req, res) => {
  try {
    const { email, title, body } = req.body;

    const tokens = await Token.find({ email });

    if (!tokens.length) {
      return res.status(404).json({ error: "Nenhum token encontrado" });
    }

    const message = {
      notification: { title, body },
      tokens: tokens.map(t => t.token),
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
