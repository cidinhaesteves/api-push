// (arquivo completo já corrigido com proteção anti-duplicação)

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import cron from "node-cron";

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "SUA_CHAVE_SUPER_SECRETA";

// FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MONGO
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error("❌ Mongo erro:", err));

// MODELS
const User = mongoose.model("User", new mongoose.Schema({
  email: String,
  password: String
}));

const Lead = mongoose.model("Lead", new mongoose.Schema({
  token: String,
  segment: { type: String, default: "geral" }
}));

const Notification = mongoose.model("Notification", new mongoose.Schema({
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now }
}));

const Schedule = mongoose.model("Schedule", new mongoose.Schema({
  title: String,
  body: String,
  sendAt: Date,
  sent: { type: Boolean, default: false },
  executedAt: Date
}));

// AUTH
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Token ausente" });

  try {
    req.user = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ================= PUSH =================
async function sendPush(data) {
  const leads = await Lead.find();
  const tokens = leads.map(l => l.token);

  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    notification: {
      title: data.title,
      body: data.body
    },
    tokens
  });

  // 🔥 GARANTE HISTÓRICO
  await Notification.create({
    title: data.title,
    body: data.body
  });
}

// ================= ROTAS =================
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).json({ error: "Usuário inválido" });

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(400).json({ error: "Senha inválida" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  res.json({ token });
});

app.post("/send-push", auth, async (req, res) => {
  await sendPush(req.body);
  res.json({ success: true });
});

app.post("/schedule", auth, async (req, res) => {
  await Schedule.create({
    title: req.body.title,
    body: req.body.body,
    sendAt: new Date(req.body.sendAt)
  });

  res.json({ success: true });
});

app.get("/schedules", auth, async (req, res) => {
  const data = await Schedule.find().sort({ sendAt: -1 });
  res.json(data);
});

app.delete("/schedule/:id", auth, async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get("/notifications", auth, async (req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 });
  res.json(data);
});

// ================= CRON FIX 🔥 =================
cron.schedule("* * * * *", async () => {
  const now = new Date();

  const schedules = await Schedule.find({
    sendAt: { $lte: now },
    sent: false
  });

  for (const item of schedules) {
    // 🔥 PROTEÇÃO DUPLICIDADE
    if (item.sent) continue;

    await sendPush(item);

    item.sent = true;
    item.executedAt = new Date();
    await item.save();

    console.log("⏰ Executado:", item.title);
  }
});

// ADMIN AUTO
mongoose.connection.once("open", async () => {
  const exists = await User.findOne({ email: "admin@email.com" });

  if (!exists) {
    const hash = await bcrypt.hash("123456", 10);
    await User.create({ email: "admin@email.com", password: hash });
    console.log("✅ Admin criado");
  }
});

// START
app.listen(10000, () => console.log("🚀 Rodando na porta 10000"));
