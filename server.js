import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import cron from "node-cron";

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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

let tokens = [];

// ==========================
// SALVAR TOKEN
// ==========================
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  res.json({ success: true });
});

// ==========================
// ENVIAR PUSH IMEDIATO
// ==========================
async function enviarPushParaTodos(titulo, mensagem) {
  await Promise.all(
    tokens.map(token =>
      admin.messaging().send({
        token,
        data: {
          title: titulo,
          body: mensagem
        }
      })
    )
  );
}

app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    await enviarPushParaTodos(titulo, mensagem);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar push" });
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

  // Converter para cron
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando 🚀");
});
