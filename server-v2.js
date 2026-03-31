import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 🔥 SERVICE ACCOUNT VIA ENV (SEM ARQUIVO)
 */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * 🧠 MEMÓRIA DE TOKENS
 */
let tokens = [];

/**
 * 📌 SALVAR TOKEN
 */
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token não enviado" });
  }

  if (!tokens.includes(token)) {
    tokens.push(token);
    console.log("📱 Token salvo:", token);
  }

  res.json({ success: true });
});

/**
 * 🚀 ENVIAR PUSH PARA TODOS + LIMPEZA AUTOMÁTICA
 */
async function enviarPushParaTodos(titulo, mensagem) {
  if (tokens.length === 0) {
    throw new Error("Nenhum token cadastrado");
  }

  const tokensInvalidos = [];

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await admin.messaging().send({
          token,
          notification: {
            title: titulo,
            body: mensagem,
          },
          webpush: {
            notification: {
              title: titulo,
              body: mensagem,
            },
          },
        });
      } catch (error) {
        console.error("❌ Erro ao enviar:", token);

        if (
          error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-registration-token"
        ) {
          console.log("🧹 Removendo inválido:", token);
          tokensInvalidos.push(token);
        }
      }
    })
  );

  // 🔥 LIMPEZA REAL
  if (tokensInvalidos.length > 0) {
    tokens = tokens.filter((t) => !tokensInvalidos.includes(t));
    console.log("🧹 Tokens limpos:", tokensInvalidos.length);
  }
}

/**
 * 📡 ROTA DE ENVIO
 */
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  try {
    await enviarPushParaTodos(titulo, mensagem);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erro geral:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 🚀 START
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
