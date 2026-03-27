import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import admin from "firebase-admin";

const app = express();
app.use(express.json());
app.use(cors());

// ================== CONFIG ==================
const JWT_SECRET = "123456";

// ================== MONGO ==================
mongoose.connect("SUA_STRING_MONGO");

const NotificationSchema = new mongoose.Schema({
title: String,
body: String,
createdAt: { type: Date, default: Date.now }
});

const ScheduleSchema = new mongoose.Schema({
title: String,
body: String,
sendAt: Date,
sent: { type: Boolean, default: false }
});

const Notification = mongoose.model("Notification", NotificationSchema);
const Schedule = mongoose.model("Schedule", ScheduleSchema);

// ================== FIREBASE ==================
admin.initializeApp({
credential: admin.credential.cert({
/* SUA CONFIG FIREBASE */
})
});

let tokens = [];

// ================== AUTH ==================
function auth(req, res, next){
const token = req.headers.authorization?.split(" ")[1];
if(!token) return res.status(401).json({error:"Sem token"});
try{
req.user = jwt.verify(token, JWT_SECRET);
next();
}catch{
return res.status(401).json({error:"Token inválido"});
}
}

// ================== LOGIN ==================
app.post("/login", async (req,res)=>{
const { email, password } = req.body;

if(email==="admin@email.com" && password==="123456"){
const token = jwt.sign({email}, JWT_SECRET);
return res.json({token});
}

res.status(401).json({error:"Login inválido"});
});

// ================== TOKEN ==================
app.post("/save-token",(req,res)=>{
tokens.push(req.body.token);
res.json({ok:true});
});

// ================== ENVIO DIRETO ==================
app.post("/send", auth, async (req,res)=>{
const { title, body } = req.body;

await admin.messaging().sendEachForMulticast({
tokens,
notification:{ title, body }
});

// 🔥 SALVAR NO BANCO (CORREÇÃO)
await Notification.create({ title, body });

res.json({success:true});
});

// ================== HISTÓRICO ==================
app.get("/notifications", auth, async (req,res)=>{
const data = await Notification.find().sort({createdAt:-1});
res.json(data);
});

// ================== ESTATÍSTICAS ==================
app.get("/stats", auth, async (req,res)=>{
const total = await Notification.countDocuments();
res.json({ total });
});

// ================== AGENDAR ==================
app.post("/schedule", auth, async (req,res)=>{
const { title, body, sendAt } = req.body;

await Schedule.create({
title,
body,
sendAt: new Date(sendAt)
});

res.json({success:true});
});

// ================== LISTAR AGENDADOS ==================
app.get("/schedules", auth, async (req,res)=>{
const data = await Schedule.find();
res.json(data);
});

// ================== CANCELAR ==================
app.delete("/schedule/:id", auth, async (req,res)=>{
await Schedule.findByIdAndDelete(req.params.id);
res.json({success:true});
});

// ================== CRON ==================
cron.schedule("* * * * *", async ()=>{

const now = new Date();
const nowBR = new Date(now.getTime() - (3 * 60 * 60 * 1000));

const schedules = await Schedule.find({
sent:false,
sendAt: { $lte: nowBR }
});

for(const item of schedules){

await admin.messaging().sendEachForMulticast({
tokens,
notification:{
title:item.title,
body:item.body
}
});

// 🔥 SALVAR NO HISTÓRICO
await Notification.create({
title:item.title,
body:item.body
});

item.sent = true;
await item.save();
}

});

app.listen(10000, ()=>console.log("🚀 Rodando"));
