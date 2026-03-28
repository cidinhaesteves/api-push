import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// 🔥 FIREBASE ADMIN VIA ENV
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
// ENVIAR PUSH
// ==============================
app.post("/send", async (req, res) => {
const { titulo, mensagem } = req.body;

if (!titulo || !mensagem) {
return res.status(400).json({ error: "Dados inválidos" });
}

if (tokens.length === 0) {
return res.status(400).json({ error: "Nenhum token registrado" });
}

try {
const results = await Promise.all(
tokens.map(token =>
admin.messaging().send({
token,
notification: {
title: titulo,
body: mensagem
}
})
)
);

```
console.log("ENVIOS:", results.length);

res.json({ success: true });
```

} catch (err) {
console.error("🔥 ERRO ENVIO REAL:", err);
res.status(500).json({ error: "Erro ao enviar push" });
}
});

// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("Servidor rodando 🚀");
});
