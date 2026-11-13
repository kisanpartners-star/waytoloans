const crypto = require('crypto');
const env = require('../config/env');

const key = () => crypto.hkdfSync('sha256', env.refreshSecret, 'banks-zone-dsa-applications-v1', Buffer.alloc(0), 32);

exports.encryptDsaPrivateDetails = (details) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(details), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
};

exports.decryptDsaPrivateDetails = (value) => {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid DSA application details');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
};
