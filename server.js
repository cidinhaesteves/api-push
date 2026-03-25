const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const mongoose = require('mongoose');

const app = express();

// 🔥 CORS LIBERADO
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// 🔥 FIREBASE ADMIN (VIA ENV - RENDER)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🔥 MONGODB
mongoose.connect('mongodb://127.0.0.1:27017/pushdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("🟢 Mongo conectado"))
.catch(err => console.log(err));

// 🔥 MODEL
const TokenSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  siteId: String,
  createdAt: { type: Date, default: Date.now }
});

const Token = mongoose.model('Token', TokenSchema);

// 🔥 ROTA TESTE
app.get('/', (req, res) => {
  res.send("🚀 API PUSH ONLINE");
});

// 🔥 SALVAR TOKEN
app.post('/save-token', async (req, res) => {
  const { token, siteId } = req.body;

  try {
    await Token.updateOne(
      { token },
      { token, siteId },
      { upsert: true }
    );

    console.log("✅ Token salvo:", token);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Erro ao salvar token:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 ENVIAR PUSH
app.post('/send', async (req, res) => {
  const { title, message, siteId } = req.body;

  try {
    const tokens = await Token.find({ siteId });

    if (tokens.length === 0) {
      return res.json({ success: false, message: "Nenhum token encontrado" });
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      notification: {
        title,
        body: message
      }
    });

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    });

  } catch (err) {
    console.error("❌ Erro ao enviar push:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 PORTA DINÂMICA (RENDER)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});