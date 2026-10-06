require('dotenv').config();
['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].forEach((k) => {
  if (!process.env[k]) { console.error(`Missing env var ${k}`); process.exit(1); }
});
module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  clientUrls: (process.env.CLIENT_URLS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.ACCESS_TTL || '15m',
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS) || 7,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  bossPanelPath: process.env.BOSS_PANEL_PATH || 'boss-secret-panel',
  boss: { name: process.env.BOSS_NAME, email: process.env.BOSS_EMAIL, password: process.env.BOSS_PASSWORD },
  smtp: { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  mailFrom: process.env.MAIL_FROM || 'no-reply@bankszone.com',
};
