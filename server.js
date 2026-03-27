const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 INICIALIZA FIREBASE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// 🔥 CONTADOR
let totalEnviados = 0;

// 🔥 TOKENS
let tokens = new Set();

// 🔥 SALVAR TOKEN
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token inválido" });
  }

  tokens.add(token);

  console.log("📱 Token salvo:", token);

  res.json({ ok: true });
});

// 🔥 ENVIO DIRETO
app.post("/send", async (req, res) => {
  const { title, body } = req.body;

  try {

    const tokenList = Array.from(tokens);

    // 🚨 VALIDAÇÃO CRÍTICA
    if (tokenList.length === 0) {
      return res.status(400).json({ error: "Nenhum token registrado" });
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokenList,
      notification: { title, body }
    });

    console.log("📤 Resultado envio:", response);

    totalEnviados++;

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ ERRO REAL:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 ENVIO AGENDADO
app.post("/schedule", (req, res) => {
  const { title, body, date } = req.body;

  const delay = new Date(date).getTime() - Date.now();

  setTimeout(async () => {
    try {

      const tokenList = Array.from(tokens);

      if (tokenList.length === 0) {
        console.log("⚠️ Nenhum token para envio agendado");
        return;
      }

      await admin.messaging().sendEachForMulticast({
        tokens: tokenList,
        notification: { title, body }
      });

      totalEnviados++;

      console.log("⏰ Executado:", title);

    } catch (err) {
      console.error("❌ ERRO AGENDADO:", err);
    }
  }, delay);

  res.json({ ok: true });
});

// 🔥 ESTATÍSTICAS
app.get("/stats", (req, res) => {
  res.json({
    total: totalEnviados
  });
});

// 🔥 PORTA
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando na porta " + PORT);
});
