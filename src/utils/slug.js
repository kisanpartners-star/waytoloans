const crypto = require('crypto');
const slugify = (s) => String(s).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
const randomId = (len = 6) => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(len)).map((b) => chars[b % chars.length]).join('');
};
module.exports = { slugify, randomId, makeCompanySlug: (name) => `${slugify(name)}-${randomId(6)}` };
