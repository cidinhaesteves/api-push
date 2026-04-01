const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

// ================================
// ENVIO GLOBAL
// ================================
router.post("/send", async (req, res) => {
  try {
    const { title, body } = req.body;

    // 🔥 GARANTA QUE ISSO EXISTE NO SEU PROJETO
    const tokens = global.tokens || [];

    if (!tokens.length) {
      return res.status(400).json({ error: "Nenhum token cadastrado" });
    }

    const message = {
      notification: {
        title,
        body,
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("✅ PUSH ENVIADO:", response);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ ERRO:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
