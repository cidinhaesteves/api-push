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

// ================= FIREBASE =================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error(err));

// ================= MODELS =================
const User = mongoose.model("User", {
  email: String,
  password: String
});

const Lead = mongoose.model("Lead", {
  token: String,
  segment: String
});

const Notification = mongoose.model("Notification", {
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now }
});

// 🔥 AGENDAMENTO
const Schedule = mongoose.model("Schedule", {
  title: String,
  body: String,
  segment: String,
  sendAt: Date,
  sent: { type: Boolean, default: false }
});

// ================= AUTH =================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;
    const decoded = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user || !user.password) {
    return res.status(400).json({ error: "Usuário inválido" });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(400).json({ error: "Senha inválida" });
  }

  const token = jwt.sign({ id: user._id }, JWT_SECRET);

  res.json({ token });
});

// ================= SAVE TOKEN =================
app.post("/save-token", async (req, res) => {
  const { token } = req.body;
  const exists = await Lead.findOne({ token });

  if (!exists) {
    await Lead.create({ token });
  }

  res.json({ ok: true });
});

// ================= SEND PUSH =================
async function sendPush({ title, body, segment }) {
  const leads = await Lead.find(segment ? { segment } : {});
  const tokens = leads.map(l => l.token);

  if (tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    tokens
  });

  await Notification.create({
    title,
    body
  });

  console.log("🚀 Push enviado:", title);
}

// ================= DISPARO MANUAL =================
app.post("/send-push", auth, async (req, res) => {
  await sendPush(req.body);
  res.json({ success: true });
});

// ================= AGENDAR PUSH =================
app.post("/schedule", auth, async (req, res) => {
  const { title, body, sendAt, segment } = req.body;

  await Schedule.create({
    title,
    body,
    sendAt,
    segment
  });

  res.json({ success: true });
});

// ================= LISTAR AGENDADOS =================
app.get("/schedules", auth, async (req, res) => {
  const data = await Schedule.find().sort({ sendAt: 1 });
  res.json(data);
});

// ================= CRON (VERIFICA A CADA MINUTO) =================
cron.schedule("* * * * *", async () => {
  const now = new Date();

  const schedules = await Schedule.find({
    sendAt: { $lte: now },
    sent: false
  });

  for (const item of schedules) {
    await sendPush(item);

    item.sent = true;
    await item.save();

    console.log("⏰ Push automático enviado:", item.title);
  }
});

// ================= ADMIN AUTO =================
async function createAdmin() {
  const email = "admin@email.com";
  const password = "123456";

  const exists = await User.findOne({ email });

  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, password: hash });
    console.log("✅ Admin criado");
  }
}

mongoose.connection.once("open", () => createAdmin());

// ================= START =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 API rodando"));
