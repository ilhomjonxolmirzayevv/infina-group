require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const OWNER_ID = process.env.OWNER_ID || '5358065809';

// Ariza topshirish
app.post('/api/apply', async (req, res) => {
    try {
        const { name, phone, telegram, direction, experience } = req.body;
        const cleanTg = telegram ? telegram.replace('@', '') : '';

        // 1. Bazaga saqlash
        const newApp = new Application({
            name,
            phone,
            telegram: cleanTg,
            direction,
            experience
        });

        await newApp.save();

        // 2. Owner (admin) ga Telegramdan xabarnoma yuborish
        const adminMessage = `📩 <b>Yangi ariza kelib tushdi!</b>\n\n` +
            `👤 <b>Ism:</b> ${name}\n` +
            `📞 <b>Telefon:</b> ${phone}\n` +
            `✈️ <b>Telegram:</b> @${cleanTg}\n` +
            `🎯 <b>Yo'nalish:</b> ${direction}\n` +
            `💼 <b>Tajriba:</b> ${experience}\n` +
            `📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;

        try {
            await bot.telegram.sendMessage(OWNER_ID, adminMessage, { parse_mode: 'HTML' });
        } catch (tgError) {
            console.error("Ownerga xabar yuborishda xatolik:", tgError.message);
        }

        res.status(200).json({ success: true, id: newApp._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MONGODB ULANISHI ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/infinagroup';

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB bazasiga muvaffaqiyatli ulandi."))
    .catch((err) => console.error("MongoDB ulanish xatosi:", err.message));

// --- MODELLAR (SCHEMAS) ---

// Arizalar sxemasi
const applicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    telegram: { type: String, required: true },
    direction: { type: String, required: true },
    experience: { type: String, required: true },
    status: { type: String, default: 'pending' },
    created_at: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);

// Postlar sxemasi
const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image_url: { type: String },
    created_at: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// --- TELEGRAM BOT ---
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.start((ctx) => ctx.reply(`Assalomu alaykum, ${ctx.from.first_name}!\nINFINA GROUP botiga xush kelibsiz.`));
bot.launch().then(() => console.log("Bot ishga tushdi!")).catch(err => console.error("Bot xatosi:", err));

// --- API: ARIZALAR ---

// Ariza topshirish
app.post('/api/apply', async (req, res) => {
    try {
        const { name, phone, telegram, direction, experience } = req.body;
        const cleanTg = telegram ? telegram.replace('@', '') : '';

        const newApp = new Application({
            name,
            phone,
            telegram: cleanTg,
            direction,
            experience
        });

        await newApp.save();
        res.status(200).json({ success: true, id: newApp._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Barcha arizalarni olish
app.get('/api/applications', async (req, res) => {
    try {
        const applications = await Application.find().sort({ created_at: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Arizani qabul qilish yoki rad etish
app.post('/api/application/:id/:action', async (req, res) => {
    const { id, action } = req.params;

    try {
        const application = await Application.findById(id);
        if (!application) return res.status(404).json({ error: "Ariza topilmadi" });

        application.status = action;
        await application.save();

        const tgUsername = `@${application.telegram}`;
        const message = action === 'accepted' 
            ? `🎉 Tabriklaymiz, ${application.name}! Siz INFINA GROUP jamoasiga qabul qilindingiz! Tez orada adminimiz bog'lanadi.`
            : `Uzur, ${application.name}. Arizangiz ko'rib chiqildi va hozircha qabul qilinmadi.`;

        try {
            await bot.telegram.sendMessage(tgUsername, message);
            res.json({ success: true, message: "Holat o'zgardi va Telegram orqali xabar yuborildi!" });
        } catch (tgErr) {
            res.json({ success: true, message: "Holat o'zgardi, lekin foydalanuvchi botga /start bosmagan bo'lishi mumkin." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API: POSTLAR ---

// Yangi post qo'shish
app.post('/api/posts', async (req, res) => {
    try {
        const { title, description, image_url } = req.body;
        const newPost = new Post({ title, description, image_url });
        await newPost.save();
        res.json({ success: true, id: newPost._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Barcha postlarni olish
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ created_at: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Postni o'chirish
app.delete('/api/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sahifalar
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => console.log(`Server http://localhost:${PORT} da ishlayapti`));