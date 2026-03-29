import express from "express";
import cors from "cors";
import admin from "firebase-admin";

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

app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  console.log("TOKENS:", tokens);
  res.json({ success: true });
});

// 🚀 ENVIO FINAL CORRETO
app.post("/send", async (req, res) => {
  const { titulo, mensagem } = req.body;

  if (!titulo || !mensagem) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  if (tokens.length === 0) {
    return res.status(400).json({ error: "Nenhum token registrado" });
  }

  let sucesso = 0;
  let falha = 0;

  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,

        // 🔥 ESSENCIAL
        notification: {
          title: titulo,
          body: mensagem
        },

        // 🔥 opcional (mantém compatibilidade)
        data: {
          title: titulo,
          body: mensagem
        }
      });

      sucesso++;

    } catch (err) {
      console.error("ERRO TOKEN:", err.message);
      falha++;
    }
  }

  console.log("SUCESSO:", sucesso);
  console.log("FALHA:", falha);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando 🚀");
});
