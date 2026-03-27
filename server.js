const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 INICIALIZA FIREBASE (caso ainda não esteja)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// 🔥 CONTADOR DE ESTATÍSTICAS
let totalEnviados = 0;

// 🔥 TOKENS
let tokens = new Set();

// 🔥 SALVAR TOKEN
app.post("/save-token", (req, res) => {
  tokens.add(req.body.token);
  res.json({ ok: true });
});

// 🔥 ENVIO DIRETO
app.post("/send", async (req, res) => {
  const { title, body } = req.body;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens: Array.from(tokens),
      notification: { title, body }
    });

    // 🔥 SOMA NA ESTATÍSTICA
    totalEnviados++;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

// 🔥 ENVIO AGENDADO (SIMPLES)
app.post("/schedule", (req, res) => {
  const { title, body, date } = req.body;

  const delay = new Date(date).getTime() - Date.now();

  setTimeout(async () => {
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: Array.from(tokens),
        notification: { title, body }
      });

      // 🔥 SOMA NA ESTATÍSTICA TAMBÉM
      totalEnviados++;

      console.log("⏰ Executado:", title);
    } catch (err) {
      console.error(err);
    }
  }, delay);

  res.json({ ok: true });
});

// 🔥 ROTA DE ESTATÍSTICAS
app.get("/stats", (req, res) => {
  res.json({
    total: totalEnviados
  });
});

// 🔥 PORTA (OBRIGATÓRIO NO RENDER)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
