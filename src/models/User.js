const mongoose = require('mongoose');
// One auth collection for all six roles. Profile data of bank/dsa/connector/employee
// lives in dedicated models (added in the next part) and is linked via userId.
const ROLES = ['boss', 'admin', 'bank', 'employee', 'dsa', 'connector'];
const userSchema = new mongoose.Schema({
  role: { type: String, enum: ROLES, required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, lowercase: true, trim: true },
  loginId: { type: String, trim: true }, // employee id / dsa id used as an alternative login
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'pending', 'rejected', 'disabled', 'blocked'], default: 'active', index: true },
  selfRegistered: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLoginAt: Date,
  lastLoginIp: String,
  passwordChangedAt: Date,
  refreshTokens: { type: [{ hash: String, expiresAt: Date }], select: false, default: [] },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
// uniqueness is per company + role so tenants never collide
userSchema.index({ companyId: 1, role: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' }, deletedAt: null } });
userSchema.index({ companyId: 1, role: 1, loginId: 1 }, { unique: true, partialFilterExpression: { loginId: { $type: 'string' }, deletedAt: null } });
userSchema.statics.ROLES = ROLES;
module.exports = mongoose.model('User', userSchema);
