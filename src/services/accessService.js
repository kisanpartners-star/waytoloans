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
    const Bank = require('../models/Bank');
    const Company = require('../models/Company');
    const manager = await SalesManager.findOne({ userId: user._id, deletedAt: null });
    const bank = manager && (manager.bankType === 'bank'
      ? await Bank.findOne({ _id: manager.bankId, deletedAt: null, status: 'active' })
      : await BankPortal.findOne({ _id: manager.bankId, deletedAt: null, status: 'active' }));
    if (!bank || manager.status !== 'active') return 'Your sales account is not active. Please contact your bank administrator.';
    if (manager.bankType === 'bank') {
      const company = await Company.findOne({ _id: bank.companyId, deletedAt: null });
      const reason = companyBlockReason(company);
      if (reason) return reason;
    }
    return null;
  }
  if (user.role !== 'employee') return null;
  const Employee = require('../models/Employee');
  const Bank = require('../models/Bank');
  const emp = await Employee.findOne({ userId: user._id, deletedAt: null });
  if (!emp) return 'Employee profile not found.';
  const bankIds = [...new Set([...(emp.bankIds || []).map(String), ...(emp.bankId ? [String(emp.bankId)] : [])])];
  if (bankIds.length && !await Bank.exists({ _id: { $in: bankIds }, companyId: emp.companyId, deletedAt: null, status: 'active' })) {
    return 'None of your assigned bank accounts are active. Please contact your company administrator.';
  }
  return null;
};
