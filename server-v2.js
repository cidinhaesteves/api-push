import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import cron from "node-cron";

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// FIREBASE INIT (COM PROTEÇÃO)
// ==========================
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT não definida");
  process.exit(1);
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log("✅ Firebase JSON OK");
} catch (err) {
  console.error("❌ Erro ao fazer parse do Firebase JSON", err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ==========================
// ROTAS BÁSICAS
// ==========================
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  if (email === "admin@email.com" && senha === "123456") {
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Credenciais inválidas" });
});

// ==========================
// TOKENS EM MEMÓRIA
// ==========================
let tokens = [];

// ==========================
// SALVAR TOKEN
// ==========================
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  console.log("📱 Token salvo:", token);
  res.json({ success: true });
});

// ==========================
// ENVIO DE PUSH (CORRIGIDO)
// ==========================
async function enviarPushParaTodos(titulo, mensagem) {
  if (tokens.length === 0) {
    throw new Error("Nenhum token cadastrado");
  }

  await Promise.all(
    tokens.map(token =>
      admin.messaging().send({
        token,
        notification: {
          title: titulo,
          body: mensagem
        },
        webpush: {
          notification: {
            title: titulo,
            body: mensagem,
            icon: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png"
          }
        }
      })
    )
  );
}

// ==========================
// ENVIAR PUSH IMEDIATO
// ==========================
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    await enviarPushParaTodos(titulo, mensagem);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao enviar push:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// AGENDAMENTO DE PUSH
// ==========================
let agendamentos = [];

app.post("/schedule", (req, res) => {
  const { titulo, mensagem, data } = req.body;

  const dataEnvio = new Date(data);
  const agora = new Date();

  if (dataEnvio <= agora) {
    return res.status(400).json({ error: "Data deve ser futura" });
  }

  const minuto = dataEnvio.getMinutes();
  const hora = dataEnvio.getHours();
  const dia = dataEnvio.getDate();
  const mes = dataEnvio.getMonth() + 1;

  const cronExp = `${minuto} ${hora} ${dia} ${mes} *`;

  const job = cron.schedule(cronExp, async () => {
    console.log("⏰ Enviando push agendado...");

    try {
      await enviarPushParaTodos(titulo, mensagem);
      console.log("✅ Push agendado enviado");
      job.stop();
    } catch (err) {
      console.error("❌ Erro no agendamento:", err);
    }
  });

  agendamentos.push({
    titulo,
    mensagem,
    data,
    cronExp
  });

  res.json({ success: true, agendado: cronExp });
});

// ==========================
// LISTAR AGENDAMENTOS
// ==========================
app.get("/schedules", (req, res) => {
  res.json(agendamentos);
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando");
});
