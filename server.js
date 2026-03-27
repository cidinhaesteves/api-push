import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// 🔥 FIREBASE ADMIN (CORRIGIDO)
// ==============================
const serviceAccount = JSON.parse(
fs.readFileSync("./serviceAccountKey.json", "utf-8")
);

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
// SALVAR TOKEN
// ==============================
let tokens = [];

app.post("/save-token", (req, res) => {
const { token } = req.body;

if (!tokens.includes(token)) {
tokens.push(token);
}

console.log("TOKENS:", tokens);
res.json({ success: true });
});

// ==============================
// 🔥 ENVIO DE PUSH (FUNCIONANDO)
// ==============================
app.post("/send", async (req, res) => {
const { titulo, mensagem } = req.body;

if (!titulo || !mensagem) {
return res.status(400).json({ error: "Dados inválidos" });
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
console.error("ERRO ENVIO:", err);
res.status(500).json({ error: "Erro ao enviar push" });
}
});

// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("Servidor rodando 🚀");
});
