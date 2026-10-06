const AuditLog = require('../models/AuditLog');
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
async function audit(req, { action, entity, entityId, meta, user, companyId, success = true }) {
  try {
    const u = user || req.user || {};
    await AuditLog.create({
      action, entity, entityId: entityId ? String(entityId) : undefined, meta, success,
      userId: u._id, userName: u.name, role: u.role,
      companyId: companyId !== undefined ? companyId : u.companyId || null,
      ip: clientIp(req), device: req.headers['user-agent'] || '',
    });
  } catch (e) { console.error('audit failed', e.message); }
}
module.exports = { audit, clientIp };
