const mongoose = require('mongoose');
const s = new mongoose.Schema({
  action: { type: String, required: true, index: true }, // LOGIN, LOGIN_FAILED, LOGOUT, CREATE, UPDATE, DELETE, STATUS_CHANGE, PASSWORD_CHANGE ...
  entity: { type: String, index: true },
  entityId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  role: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  ip: String,
  device: String,
  success: { type: Boolean, default: true },
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
s.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', s);
