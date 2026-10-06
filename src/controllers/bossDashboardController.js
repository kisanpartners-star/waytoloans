const Company = require('../models/Company');
const User = require('../models/User');
const LoanType = require('../models/LoanType');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysAgo = (n) => { const x = startOfDay(); x.setDate(x.getDate() - n); return x; };
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
// zero-filled daily series
const fill = (rows, days, key = 'n') => {
  const m = {}; rows.forEach((r) => { m[r._id] = r[key]; });
  return Array.from({ length: days }, (_, i) => { const d = daysAgo(days - 1 - i); const k = dayKey(new Date(d.getTime() - d.getTimezoneOffset() * 60000)); return { date: k, value: m[k] || 0 }; });
};
const daily = (days, match, Model) => Model.aggregate([
  { $match: { ...match, createdAt: { $gte: daysAgo(days - 1) } } },
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
]);

exports.stats = asyncHandler(async (req, res) => {
  const today = startOfDay(); const week = daysAgo(6); const month = daysAgo(29);
  const live = { deletedAt: null };
  const cc = (extra = {}) => Company.countDocuments({ ...live, ...extra });
  const uc = (role, extra = {}) => User.countDocuments({ role, deletedAt: null, ...extra });
  const [
    total, liveC, active, disabled, draft, blocked, loginDisabled, maintenance,
    admins, banks, dsas, connectors, employees,
    regToday, regWeek, regMonth, pendingBanks, pendingConnectors,
    loginsToday, failedToday, auditToday, loanTypes, loanTypesPub, policies, policiesPub,
    regSeries, loginSeries, failedSeries, recent,
  ] = await Promise.all([
    cc(), cc({ status: 'live' }), cc({ status: 'live', enabled: true, blocked: false }), cc({ enabled: false }), cc({ status: 'draft' }), cc({ blocked: true }), cc({ loginDisabled: true }), cc({ maintenanceMode: true }),
    uc('admin'), uc('bank'), uc('dsa'), uc('connector'), uc('employee'),
    cc({ createdAt: { $gte: today } }), cc({ createdAt: { $gte: week } }), cc({ createdAt: { $gte: month } }),
    uc('bank', { status: 'pending' }), uc('connector', { status: 'pending' }),
    AuditLog.countDocuments({ action: 'LOGIN', createdAt: { $gte: today } }),
    AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: today } }),
    AuditLog.countDocuments({ createdAt: { $gte: today } }),
    LoanType.countDocuments(live), LoanType.countDocuments({ ...live, status: 'published' }),
    Policy.countDocuments(live), Policy.countDocuments({ ...live, status: 'published' }),
    daily(30, live, Company), daily(14, { action: 'LOGIN' }, AuditLog), daily(14, { action: 'LOGIN_FAILED' }, AuditLog),
    Company.find(live).sort({ createdAt: -1 }).limit(10).select('name slug email phone status enabled blocked loginDisabled createdAt').lean(),
  ]);

  const disabledOnly = await cc({ enabled: false, blocked: false });
  const draftOnly = await cc({ status: 'draft', enabled: true, blocked: false });
  const cards = {
    totalCompanies: total, liveCompanies: liveC, activeCompanies: active, disabledCompanies: disabled, draftCompanies: draft,
    blockedCompanies: blocked, loginDisabledCompanies: loginDisabled, maintenanceCompanies: maintenance,
    totalAdmins: admins, totalBanks: banks, totalDsas: dsas, totalConnectors: connectors, totalEmployees: employees,
    registrationsToday: regToday, registrationsThisWeek: regWeek, registrationsThisMonth: regMonth,
    pendingRegistrations: pendingBanks + pendingConnectors, pendingBanks, pendingConnectors,
    loginsToday, failedLoginsToday: failedToday, auditEventsToday: auditToday,
    loanTypes, publishedLoanTypes: loanTypesPub, policies, publishedPolicies: policiesPub,
  };
  const charts = {
    registrationsOverTime: fill(regSeries, 30),
    usersByRole: [{ name: 'Admins', value: admins }, { name: 'Banks', value: banks }, { name: 'Employees', value: employees }, { name: 'DSAs', value: dsas }, { name: 'Connectors', value: connectors }],
    statusSplit: [
      { name: 'Active', value: active }, { name: 'Draft', value: draftOnly }, { name: 'Disabled', value: disabledOnly }, { name: 'Blocked', value: blocked },
    ],
    loginsTrend: fill(loginSeries, 14).map((p, i) => ({ date: p.date, success: p.value, failed: fill(failedSeries, 14)[i].value })),
  };
  res.json({ success: true, data: { cards, charts, recentCompanies: recent } });
});
