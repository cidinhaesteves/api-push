import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// 🔥 FIREBASE ADMIN
// ==============================
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ==============================
// TESTE
// ==============================
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// ==============================
// 🔐 LOGIN
// ==============================
app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  if (email === "admin@email.com" && senha === "123456") {
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Credenciais inválidas" });
});

// ==============================
// MEMÓRIA DE TOKENS
// ==============================
let tokens = [];

// ==============================
// SALVAR TOKEN
// ==============================
app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  console.log("TOKENS:", tokens);
  res.json({ success: true });
});

// ==============================
// ENVIAR PUSH (CORRIGIDO)
// ==============================
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
  let tokensValidos = [];

  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        data: {
          title: titulo,
          body: mensagem
        }
      });

      sucesso++;
      tokensValidos.push(token);

    } catch (err) {
      console.error("❌ ERRO TOKEN:", token, err.message);
      falha++;
    }
  }

  // 🔥 limpa tokens inválidos automaticamente
  tokens = tokensValidos;

  console.log("✅ SUCESSO:", sucesso);
  console.log("❌ FALHA:", falha);

  return res.json({
    success: true,
    enviados: sucesso,
    falharam: falha
  });
});

// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando 🚀");
});
