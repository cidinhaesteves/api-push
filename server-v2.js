import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import cron from "node-cron";

const app = express();
app.use(cors());
app.use(express.json());

let firebaseReady = false;

// ==========================
// FIREBASE INIT ULTRA SEGURO
// ==========================
try {
  const env = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!env) {
    console.error("❌ ENV FIREBASE NÃO DEFINIDA");
  } else {
    const serviceAccount = JSON.parse(env);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseReady = true;

    console.log("✅ Firebase inicializado");
  }
} catch (error) {
  console.error("❌ ERRO FIREBASE:", error.message);
}

// ==========================
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// ==========================
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!global.tokens) global.tokens = [];

  if (!global.tokens.includes(token)) {
    global.tokens.push(token);
  }

  console.log("📱 Tokens:", global.tokens.length);

  res.json({ success: true });
});

// ==========================
async function enviarPushParaTodos(titulo, mensagem) {
  if (!firebaseReady) {
    throw new Error("Firebase não inicializado");
  }

  if (!global.tokens || global.tokens.length === 0) {
    throw new Error("Nenhum token cadastrado");
  }

  const promises = global.tokens.map(token =>
    admin.messaging().send({
      token,
      notification: {
        title: titulo,
        body: mensagem
      }
    })
  );

  return Promise.all(promises);
}

// ==========================
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    await enviarPushParaTodos(titulo, mensagem);

    console.log("✅ PUSH ENVIADO");

    res.json({ success: true });
  } catch (err) {
    console.error("❌ ERRO:", err.message);

    res.status(500).json({
      error: err.message
    });
  }
});

// ==========================
const PORT = process.env.PORT || 10000;

// 🔥 IMPORTANTE: SEMPRE SOBE O SERVIDOR
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});