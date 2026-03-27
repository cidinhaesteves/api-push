const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 CONTADOR EM MEMÓRIA
let totalEnviados = 0;

// 🔥 TOKENS
let tokens = new Set();

// 🔥 SALVAR TOKEN
app.post("/save-token", (req, res) => {
  tokens.add(req.body.token);
  res.json({ ok: true });
});

// 🔥 ENVIAR PUSH
app.post("/send", async (req, res) => {
  const { title, body } = req.body;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens: Array.from(tokens),
      notification: { title, body }
    });

    // 🔥 INCREMENTA CONTADOR
    totalEnviados++;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar" });
  }
});

// 🔥 ROTA DE ESTATÍSTICAS (AQUI ESTAVA FALTANDO)
app.get("/stats", (req, res) => {
  res.json({
    total: totalEnviados
  });
});

// 🔥 START
app.listen(3000, () => {
  console.log("Servidor rodando...");
});
