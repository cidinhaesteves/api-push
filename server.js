require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const mongoose = require("mongoose");
const cron = require("node-cron");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   🔥 FIREBASE CONFIG
========================= */
const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* =========================
   🔥 MONGODB
========================= */
mongoose.connect(process.env.MONGO_URI);

const NotificationSchema = new mongoose.Schema({
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now },
});

const ScheduleSchema = new mongoose.Schema({
  title: String,
  body: String,
  sendAt: Date,
  sent: { type: Boolean, default: false },
});

const Notification = mongoose.model("Notification", NotificationSchema);
const Schedule = mongoose.model("Schedule", ScheduleSchema);

/* =========================
   🔥 TOKENS (SEM DUPLICAR)
========================= */
let tokens = new Set();

app.post("/save-token", (req, res) => {
  tokens.add(req.body.token);
  res.json({ ok: true });
});

/* =========================
   🔥 AUTH SIMPLES
========================= */
const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Sem token" });
  }

  next();
};

/* =========================
   🚀 ENVIAR PUSH DIRETO
========================= */
app.post("/send", auth, async (req, res) => {
  const { title, body } = req.body;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens: Array.from(tokens),
      notification: { title, body },
    });

    await Notification.create({ title, body });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

/* =========================
   ⏰ AGENDAR PUSH
========================= */
app.post("/schedule", auth, async (req, res) => {
  const { title, body, sendAt } = req.body;

  try {
    await Schedule.create({
      title,
      body,
      sendAt: new Date(sendAt),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao agendar" });
  }
});

/* =========================
   🔄 CRON (EXECUTA A CADA MIN)
========================= */
cron.schedule("* * * * *", async () => {
  const now = new Date();

  // 🔥 AJUSTE BRASIL (-3h)
  const nowBR = new Date(now.getTime() - (3 * 60 * 60 * 1000));

  const schedules = await Schedule.find({
    sent: false,
    sendAt: { $lte: nowBR },
  });

  for (let item of schedules) {
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: Array.from(tokens),
        notification: {
          title: item.title,
          body: item.body,
        },
      });

      await Notification.create({
        title: item.title,
        body: item.body,
      });

      item.sent = true;
      await item.save();

      console.log("✅ Enviado:", item.title);
    } catch (err) {
      console.error("Erro cron:", err);
    }
  }
});

/* =========================
   📜 HISTÓRICO
========================= */
app.get("/notifications", auth, async (req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 });
  res.json(data);
});

/* =========================
   📊 ESTATÍSTICAS (CORRIGIDO)
========================= */
app.get("/stats", auth, async (req, res) => {
  const total = await Notification.countDocuments();
  res.json({ total });
});

/* =========================
   📋 LISTAR AGENDAMENTOS
========================= */
app.get("/schedules", auth, async (req, res) => {
  const data = await Schedule.find().sort({ sendAt: -1 });
  res.json(data);
});

/* =========================
   ❌ CANCELAR AGENDAMENTO
========================= */
app.delete("/schedule/:id", auth, async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(3000, () => {
  console.log("🚀 Server rodando na porta 3000");
});
