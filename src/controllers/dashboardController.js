// Real, tenant-scoped dashboards for admin / bank / employee / dsa / connector.
const Bank = require('../models/Bank');
const Connector = require('../models/Connector');
const Dsa = require('../models/Dsa');
const Employee = require('../models/Employee');
const User = require('../models/User');
const LoanType = require('../models/LoanType');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { summary, dailySeries, startOfDay, daysAgo, ageInDays } = require('../services/statsService');

const loginCount = (match, since) => AuditLog.countDocuments({ action: 'LOGIN', createdAt: { $gte: since }, ...match });

exports.admin = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId; const m = { companyId };
  const [banks, conns, dsas, emps, publishedLoanTypes, totalUsers, loginsToday, failedToday, auditToday, logins14, failed14,
    bankSeries, connSeries, dsaSeries, recentBanks, recentConnectors, recentDsas] = await Promise.all([
    summary(Bank, m), summary(Connector, m), summary(Dsa, m), summary(Employee, m),
    LoanType.countDocuments({ deletedAt: null, status: 'published' }),
    User.countDocuments({ companyId, deletedAt: null }),
    loginCount(m, startOfDay()), AuditLog.countDocuments({ ...m, action: 'LOGIN_FAILED', createdAt: { $gte: startOfDay() } }),
    AuditLog.countDocuments({ ...m, createdAt: { $gte: startOfDay() } }),
    dailySeries(AuditLog, { ...m, action: 'LOGIN' }, 14), dailySeries(AuditLog, { ...m, action: 'LOGIN_FAILED' }, 14),
    dailySeries(Bank, { ...m, deletedAt: null }, 30), dailySeries(Connector, { ...m, deletedAt: null }, 30), dailySeries(Dsa, { ...m, deletedAt: null }, 30),
    Bank.find({ ...m, deletedAt: null }).sort({ createdAt: -1 }).limit(5).select('bankName email phone status createdAt').lean(),
    Connector.find({ ...m, deletedAt: null }).sort({ createdAt: -1 }).limit(5).select('fullName email phone status createdAt').lean(),
    Dsa.find({ ...m, deletedAt: null }).sort({ createdAt: -1 }).limit(5).select('name dsaId branch status createdAt').lean(),
  ]);
  const cards = {
    totalBanks: banks.total, activeBanks: banks.active, disabledBanks: banks.disabled, pendingBanks: banks.pending, rejectedBanks: banks.rejected, selfRegisteredBanks: banks.selfRegistered,
    bankRegistrationsToday: banks.today, bankRegistrationsThisWeek: banks.week, bankRegistrationsThisMonth: banks.month,
    totalConnectors: conns.total, activeConnectors: conns.active, disabledConnectors: conns.disabled, pendingConnectors: conns.pending, rejectedConnectors: conns.rejected, selfRegisteredConnectors: conns.selfRegistered,
    connectorRegistrationsToday: conns.today, connectorRegistrationsThisWeek: conns.week, connectorRegistrationsThisMonth: conns.month,
    totalDsas: dsas.total, activeDsas: dsas.active, disabledDsas: dsas.disabled, dsasAddedThisMonth: dsas.month,
    totalEmployees: emps.total, activeEmployees: emps.active, disabledEmployees: emps.disabled, employeesAddedThisMonth: emps.month,
    pendingApprovals: banks.pending + conns.pending, publishedLoanTypes, totalUsers,
    loginsToday, failedLoginsToday: failedToday, auditEventsToday: auditToday,
  };
  const charts = {
    registrationsOverTime: bankSeries.map((p, i) => ({ date: p.date, banks: p.value, connectors: connSeries[i].value, dsas: dsaSeries[i].value })),
    banksByStatus: [{ name: 'Active', value: banks.active }, { name: 'Pending', value: banks.pending }, { name: 'Disabled', value: banks.disabled }, { name: 'Rejected', value: banks.rejected }],
    connectorsByStatus: [{ name: 'Active', value: conns.active }, { name: 'Pending', value: conns.pending }, { name: 'Disabled', value: conns.disabled }, { name: 'Rejected', value: conns.rejected }],
    peopleByRole: [{ name: 'Banks', value: banks.total }, { name: 'Employees', value: emps.total }, { name: 'DSAs', value: dsas.total }, { name: 'Connectors', value: conns.total }],
    loginsTrend: logins14.map((p, i) => ({ date: p.date, success: p.value, failed: failed14[i].value })),
  };
  res.json({ success: true, data: { cards, charts, recent: { banks: recentBanks, connectors: recentConnectors, dsas: recentDsas } } });
});

exports.bank = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const bank = await Bank.findOne({ userId: req.user._id, companyId, deletedAt: null });
  if (!bank) throw new ApiError(403, 'Bank profile not found');
  const m = { companyId, bankId: bank._id };
  const [emps, byLoan, dsaAgg, linkedDsas, logins, loginsMonth, series, recent] = await Promise.all([
    summary(Employee, m),
    Employee.aggregate([{ $match: { ...m, deletedAt: null } }, { $group: { _id: '$loanTypeId', n: { $sum: 1 } } }, { $lookup: { from: 'loantypes', localField: '_id', foreignField: '_id', as: 'lt' } }, { $project: { name: { $ifNull: [{ $arrayElemAt: ['$lt.name', 0] }, 'Unknown'] }, value: '$n' } }, { $sort: { value: -1 } }]),
    Employee.aggregate([{ $match: { ...m, deletedAt: null } }, { $unwind: '$dsas' }, { $group: { _id: null, rows: { $sum: 1 }, distinct: { $addToSet: '$dsas.dsaId' } } }]),
    Dsa.countDocuments({ companyId, deletedAt: null, status: 'active', bankIds: bank._id }),
    loginCount({ userId: req.user._id }, startOfDay()), loginCount({ userId: req.user._id }, daysAgo(29)),
    dailySeries(Employee, { ...m, deletedAt: null }, 30),
    Employee.find({ ...m, deletedAt: null }).sort({ createdAt: -1 }).limit(5).select('name employeeId email status createdAt').lean(),
  ]);
  const cards = {
    totalEmployees: emps.total, activeEmployees: emps.active, disabledEmployees: emps.disabled,
    employeesAddedToday: emps.today, employeesAddedThisWeek: emps.week, employeesAddedThisMonth: emps.month,
    loanTypesCovered: byLoan.length, dsasLinkedToBank: linkedDsas, dsasAssignedToEmployees: dsaAgg[0]?.distinct.length || 0, dsaAssignments: dsaAgg[0]?.rows || 0,
    loginsToday: logins, loginsLast30Days: loginsMonth, accountAgeDays: ageInDays(bank.createdAt),
  };
  res.json({ success: true, data: { cards, charts: { employeesOverTime: series, employeesByLoanType: byLoan, employeesByStatus: [{ name: 'Active', value: emps.active }, { name: 'Disabled', value: emps.disabled }] }, recent: { employees: recent }, bank: { bankName: bank.bankName, status: bank.status } } });
});

exports.employee = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const emp = await Employee.findOne({ userId: req.user._id, companyId, deletedAt: null }).populate('loanTypeId', 'name').populate('bankId', 'bankName');
  if (!emp) throw new ApiError(403, 'Employee profile not found');
  const [teammates, sameLoan, loginsMonth, loginsToday] = await Promise.all([
    Employee.countDocuments({ companyId, bankId: emp.bankId._id, deletedAt: null, status: 'active', _id: { $ne: emp._id } }),
    Employee.countDocuments({ companyId, bankId: emp.bankId._id, loanTypeId: emp.loanTypeId?._id, deletedAt: null, status: 'active', _id: { $ne: emp._id } }),
    loginCount({ userId: req.user._id }, daysAgo(29)), loginCount({ userId: req.user._id }, startOfDay()),
  ]);
  const cards = { linkedDsas: emp.dsas.length, bankTeammates: teammates, teammatesOnSameLoanType: sameLoan, loginsToday, loginsLast30Days: loginsMonth, accountAgeDays: ageInDays(emp.createdAt) };
  res.json({ success: true, data: { cards, info: { bank: emp.bankId?.bankName, loanType: emp.loanTypeId?.name, employeeId: emp.employeeId, status: emp.status }, dsas: emp.dsas } });
});

exports.dsa = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const dsa = await Dsa.findOne({ userId: req.user._id, companyId, deletedAt: null }).populate('loanTypeIds', 'name').populate('bankIds', 'bankName');
  if (!dsa) throw new ApiError(403, 'DSA profile not found');
  const [empsLinked, empsAvailable, loginsMonth, loginsToday] = await Promise.all([
    Employee.countDocuments({ companyId, deletedAt: null, status: 'active', 'dsas.dsaId': dsa._id }),
    Employee.countDocuments({ companyId, deletedAt: null, status: 'active', bankId: { $in: dsa.bankIds.map((b) => b._id) }, loanTypeId: { $in: dsa.loanTypeIds.map((l) => l._id) } }),
    loginCount({ userId: req.user._id }, daysAgo(29)), loginCount({ userId: req.user._id }, startOfDay()),
  ]);
  const cards = { assignedBanks: dsa.bankIds.length, assignedLoanTypes: dsa.loanTypeIds.length, employeesLinkedToMe: empsLinked, matchingBankEmployees: empsAvailable, loginsToday, loginsLast30Days: loginsMonth, accountAgeDays: ageInDays(dsa.createdAt) };
  res.json({ success: true, data: { cards, info: { dsaId: dsa.dsaId, branch: dsa.branch, status: dsa.status }, banks: dsa.bankIds, loanTypes: dsa.loanTypeIds } });
});

exports.connector = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const conn = await Connector.findOne({ userId: req.user._id, companyId, deletedAt: null });
  if (!conn) throw new ApiError(403, 'Connector profile not found');
  const [banks, dsas, publishedLoanTypes, loginsMonth, loginsToday] = await Promise.all([
    Bank.countDocuments({ companyId, deletedAt: null, status: 'active' }), Dsa.countDocuments({ companyId, deletedAt: null, status: 'active' }),
    LoanType.countDocuments({ deletedAt: null, status: 'published' }),
    loginCount({ userId: req.user._id }, daysAgo(29)), loginCount({ userId: req.user._id }, startOfDay()),
  ]);
  const cards = { activeBanksInNetwork: banks, activeDsasInNetwork: dsas, loanTypesAvailable: publishedLoanTypes, loginsToday, loginsLast30Days: loginsMonth, accountAgeDays: ageInDays(conn.createdAt) };
  res.json({ success: true, data: { cards, info: { status: conn.status, selfRegistered: conn.selfRegistered } } });
});
