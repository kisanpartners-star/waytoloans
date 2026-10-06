const nodemailer = require('nodemailer');
const env = require('../config/env');
let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined });
}
// Sends through SMTP when configured; otherwise logs the message (development).
async function sendMail({ to, subject, text }) {
  if (!transporter) { console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`); return; }
  await transporter.sendMail({ from: env.mailFrom, to, subject, text });
}
module.exports = { sendMail };
