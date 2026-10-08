// Central place that decides whether a user/company may log in or keep using the API.
const companyBlockReason = (c) => {
  if (!c || c.deletedAt) return 'This company panel does not exist.';
  if (c.status === 'draft') return 'This company panel is not published yet.';
  if (c.blocked) return 'This company has been blocked. Please contact Today Technologies support.';
  if (!c.enabled) return 'This company panel is currently disabled.';
  if (c.loginDisabled) return 'Login has been disabled for this company.';
  if (c.maintenanceMode) return c.maintenanceMessage || 'This panel is under maintenance. Please try again later.';
  return null;
};
const userBlockReason = (u) => {
  switch (u.status) {
    case 'pending': return 'Your registration is pending approval by the company admin.';
    case 'rejected': return 'Your registration was rejected. Please contact the company admin.';
    case 'disabled': return 'Your account has been disabled. Please contact your administrator.';
    case 'blocked': return 'Your account has been blocked. Please contact your administrator.';
    default: return null;
  }
};
module.exports = { companyBlockReason, userBlockReason };

// Employees can only work while their bank is active.
module.exports.parentBlockReason = async (user) => {
  if (user.role === 'bankPortal') {
    const BankPortal = require('../models/BankPortal');
    const bank = await BankPortal.findOne({ userId: user._id, deletedAt: null });
    if (!bank || bank.status !== 'active') return 'Your bank portal is not active.';
    return null;
  }
  if (user.role === 'salesManager') {
    const SalesManager = require('../models/SalesManager');
    const BankPortal = require('../models/BankPortal');
    const manager = await SalesManager.findOne({ userId: user._id, deletedAt: null });
    const bank = manager && await BankPortal.findOne({ _id: manager.bankId, deletedAt: null, status: 'active' });
    if (!bank || manager.status !== 'active') return 'Your sales account is not active. Please contact your bank administrator.';
    return null;
  }
  if (user.role !== 'employee') return null;
  const Employee = require('../models/Employee');
  const Bank = require('../models/Bank');
  const emp = await Employee.findOne({ userId: user._id, deletedAt: null });
  if (!emp) return 'Employee profile not found.';
  const bank = await Bank.findOne({ _id: emp.bankId, deletedAt: null });
  if (!bank || bank.status !== 'active') return 'Your bank account is not active. Please contact your bank administrator.';
  return null;
};
