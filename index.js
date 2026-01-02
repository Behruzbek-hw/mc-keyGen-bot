const express = require('express');
const app = express();
app.use(express.json());

// Bu yerga o'zingizning valid keylaringizni qo'shing (Discord botdan generatsiya qilganlarni)
const validKeys = new Set([
  'MySecretKey2026',  // Misol keylar — o'zgartiring yoki bo'sh qoldiring
  'KeyForFriend1',
  'AnotherKey2026'
]);

app.post('/sendValue', (req, res) => {
  const body = req.body;
  const license = body.license || body.token;

  if (!license) {
    return res.status(400).json({ error: "No code provided", code: "invalid_code" });
  }

  if (validKeys.has(license)) {
    const token = Math.random().toString(36).substring(2, 15); // Yangi token generatsiya
    console.log(`Muvaffaqiyatli key: ${license} → token: ${token}`);
    res.json({ salt: "success", token: token }); // Plugin kutgan format
  } else {
    res.status(400).json({ error: "Invalid license key", code: "invalid_code" });
  }
});

// Rate limit oddiy (429)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend ishlayapti port ${port} da`));
