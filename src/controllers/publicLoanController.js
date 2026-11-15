const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const PublicLoanApplication = require('../models/PublicLoanApplication');
const { flows, getFlowForLoanType } = require('../loanFormConfig');

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k, v]) => v !== undefined).map(([k, v]) => [k, sanitizeValue(v)]));
  }
  if (typeof value === 'string') return value.trim();
  return value;
};

const readConfigForType = (loanType) => {
  const flow = getFlowForLoanType(loanType);
  return { flow, steps: flows[flow].steps, label: flows[flow].label };
};

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const getAccessToken = (req) => {
  const header = req.headers['x-access-token'] || req.headers.authorization;
  if (typeof header === 'string') {
    if (header.startsWith('Bearer ')) return header.slice(7);
    return header;
  }
  return null;
};

const requireApplicationAccess = async (req, res, next) => {
  const appId = req.params.id;
  const app = await PublicLoanApplication.findById(appId);
  if (!app) throw new ApiError(404, 'Application not found');
  const token = getAccessToken(req);
  if (!token) throw new ApiError(401, 'Access token required');
  if (!app.accessTokenHash || hashToken(token) !== app.accessTokenHash) {
    throw new ApiError(403, 'Invalid or expired access token');
  }
  req.application = app;
  next();
};

const collectConfigs = (flow) => {
  const allFields = [];
  (flows[flow]?.steps || []).forEach((step) => {
    step.sections?.forEach((section) => {
      section.fields?.forEach((field) => {
        allFields.push(field);
      });
    });
  });
  return allFields;
};

const valueMatches = (value, expected) => {
  if (expected === undefined || expected === null) return true;
  if (typeof expected === 'object' && expected.field) {
    return value === expected.equals;
  }
  return value === expected;
};

const fieldVisible = (field, formData) => {
  if (!field.showIf) return true;
  const target = field.showIf.field;
  if (!target) return true;
  const actual = formData?.[target];
  return valueMatches(actual, field.showIf.equals);
};

const validateSingleField = (field, value) => {
  if (field.type === 'checkbox' || field.type === 'multi-checkbox') {
    return true;
  }
  if (value === undefined || value === null || value === '') {
    return !field.required;
  }
  if (field.validation?.pattern) {
    const regex = new RegExp(field.validation.pattern, 'i');
    return regex.test(String(value));
  }
  if (field.validation?.min !== undefined && Number(value) < field.validation.min) return false;
  if (field.validation?.max !== undefined && Number(value) > field.validation.max) return false;
  if (field.type === 'number' && Number.isNaN(Number(value))) return false;
  return true;
};

const validateAgainstConfig = (flow, formData) => {
  const errors = [];
  const fields = collectConfigs(flow);
  fields.forEach((field) => {
    if (!fieldVisible(field, formData)) return;
    const value = formData[field.name];
    if (field.required && !fieldVisible(field, formData)) return;
    if (field.required && !validateSingleField(field, value)) {
      errors.push({ field: field.name, message: `${field.label || field.name} is required` });
    }
    if (value !== undefined && value !== null && value !== '' && !validateSingleField(field, value)) {
      errors.push({ field: field.name, message: `${field.label || field.name} is invalid` });
    }
  });
  return errors;
};

const buildBaseUploadDir = (applicationId) => path.join(__dirname, '..', '..', 'uploads', 'public-loans', String(applicationId));

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const appId = req.params.id || req.body?.applicationId;
    const targetDir = buildBaseUploadDir(appId);
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const randomName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext || ''}`;
    cb(null, randomName);
  },
});

const allowedMedia = {
  pdf: ['application/pdf'],
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
};

const validExtensionForMime = (mimeType) => {
  const list = Object.values(allowedMedia).flat();
  return list.includes(mimeType);
};

const uploadPublicLoan = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = validExtensionForMime(file.mimetype) && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype.startsWith('video/'));
    if (allowed) return cb(null, true);
    cb(new ApiError(422, 'Unsupported file type. Allowed: PDF, JPG, JPEG, PNG, WEBP, MP4, MOV, WEBM'));
  },
});

exports.getFormConfig = asyncHandler(async (req, res) => {
  const loanType = String(req.params.loanType || '').trim();
  const flow = getFlowForLoanType(loanType);
  const flowConfig = flows[flow];
  if (!flowConfig) throw new ApiError(400, 'Invalid loan type');
  res.json({ success: true, data: { loanType, flow, config: flowConfig } });
});

exports.start = asyncHandler(async (req, res) => {
  const payload = sanitizeValue(req.body || {});
  const name = String(payload.name || '').trim();
  const mobile = String(payload.mobile || '').trim();
  const loanType = String(payload.loanType || '').trim();
  if (!name || !loanType) throw new ApiError(400, 'Name and loan type are required');
  const pattern = /^[6-9]\d{9}$/;
  if (!pattern.test(mobile)) throw new ApiError(400, 'Mobile number must be 10 digits starting with 6-9');
  const flow = getFlowForLoanType(loanType);
  const accessToken = crypto.randomBytes(24).toString('hex');
  const app = await PublicLoanApplication.create({
    name,
    mobile,
    loanType,
    flow,
    status: 'draft',
    accessTokenHash: hashToken(accessToken),
    currentStep: 0,
    formData: { name, mobile, loanType },
  });
  res.status(201).json({ success: true, data: { applicationId: app._id.toString(), accessToken } });
});

exports.updateStep = asyncHandler(async (req, res) => {
  const app = req.application;
  const data = sanitizeValue(req.body || {});
  const flow = app.flow || getFlowForLoanType(app.loanType);
  const cleaned = Object.entries(data).reduce((acc, [key, value]) => {
    if (key === 'currentStep' || key === 'accessToken' || key === 'applicationId') return acc;
    acc[key] = value;
    return acc;
  }, {});
  const cfg = flows[flow];
  if (!cfg) throw new ApiError(400, 'Invalid loan flow');
  const validationErrors = validateAgainstConfig(flow, { ...app.formData, ...cleaned });
  if (validationErrors.length) {
    return res.status(400).json({ success: false, message: validationErrors[0].message, details: validationErrors });
  }
  app.formData = { ...app.formData, ...cleaned };
  if (typeof data.currentStep === 'number') app.currentStep = data.currentStep;
  await app.save();
  res.json({ success: true, data: { applicationId: app._id, currentStep: app.currentStep, formData: app.formData } });
});

exports.uploadDocument = [
  uploadPublicLoan.single('file'),
  asyncHandler(async (req, res) => {
    const app = req.application;
    const docKey = String(req.body.docKey || req.body.key || '').trim();
    if (!req.file) throw new ApiError(400, 'File is required');
    if (!docKey) throw new ApiError(400, 'Document key is required');
    const sizeLimit = docKey.includes('video') || docKey.toLowerCase().includes('video') ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
    if (req.file.size > sizeLimit) throw new ApiError(413, 'Uploaded file exceeds the allowed limit');
    const relativeUrl = `/uploads/public-loans/${app._id}/${req.file.filename}`;
    const doc = {
      key: docKey,
      label: docKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim(),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: relativeUrl,
      uploadedAt: new Date(),
    };
    app.documents = app.documents || [];
    const existingIndex = app.documents.findIndex((item) => item.key === docKey && item.originalName === doc.originalName);
    if (existingIndex >= 0) app.documents.splice(existingIndex, 1);
    app.documents.push(doc);
    await app.save();
    res.status(201).json({ success: true, data: doc });
  }),
];

exports.deleteDocument = asyncHandler(async (req, res) => {
  const app = req.application;
  const target = app.documents.id(req.params.docId);
  if (!target) throw new ApiError(404, 'Document not found');
  const diskPath = path.join(__dirname, '..', '..', 'uploads', 'public-loans', String(app._id), path.basename(target.url));
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  app.documents = app.documents.filter((doc) => String(doc._id) !== String(req.params.docId));
  await app.save();
  res.json({ success: true, data: { removed: true } });
});

exports.submit = asyncHandler(async (req, res) => {
  const app = req.application;
  const flow = app.flow || getFlowForLoanType(app.loanType);
  const validationErrors = validateAgainstConfig(flow, app.formData || {});
  if (validationErrors.length) {
    return res.status(400).json({ success: false, message: validationErrors[0].message, details: validationErrors });
  }
  if (!app.applicationNo) {
    const prefix = 'LN';
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let n = 1;
    let candidate = `${prefix}-${stamp}-${String(n).padStart(4, '0')}`;
    while (await PublicLoanApplication.exists({ applicationNo: candidate })) {
      n += 1;
      candidate = `${prefix}-${stamp}-${String(n).padStart(4, '0')}`;
    }
    app.applicationNo = candidate;
  }
  app.status = 'submitted';
  app.submittedAt = new Date();
  app.statusHistory = app.statusHistory || [];
  app.statusHistory.push({ status: 'submitted', by: 'customer', at: new Date(), note: 'Application submitted' });
  await app.save();
  res.json({ success: true, data: { applicationNo: app.applicationNo, status: app.status } });
});

exports.listForBoss = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.search) {
    const text = String(req.query.search).trim();
    filter.$or = [
      { name: { $regex: text, $options: 'i' } },
      { mobile: { $regex: text, $options: 'i' } },
      { applicationNo: { $regex: text, $options: 'i' } },
    ];
  }
  if (req.query.loanType) filter.loanType = req.query.loanType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const total = await PublicLoanApplication.countDocuments(filter);
  const items = await PublicLoanApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  res.json({ success: true, data: { items, page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

exports.statsForBoss = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [total, newToday, drafts, submitted, underReview, approved, rejected] = await Promise.all([
    PublicLoanApplication.countDocuments(),
    PublicLoanApplication.countDocuments({ createdAt: { $gte: today } }),
    PublicLoanApplication.countDocuments({ status: 'draft' }),
    PublicLoanApplication.countDocuments({ status: 'submitted' }),
    PublicLoanApplication.countDocuments({ status: 'under_review' }),
    PublicLoanApplication.countDocuments({ status: 'approved' }),
    PublicLoanApplication.countDocuments({ status: 'rejected' }),
  ]);
  res.json({ success: true, data: { total, newToday, drafts, submitted, underReview, approved, rejected } });
});

exports.getByIdForBoss = asyncHandler(async (req, res) => {
  const app = await PublicLoanApplication.findById(req.params.id);
  if (!app) throw new ApiError(404, 'Application not found');
  app.isViewedByBoss = true;
  await app.save();
  res.json({ success: true, data: app });
});

exports.updateStatusForBoss = asyncHandler(async (req, res) => {
  const app = await PublicLoanApplication.findById(req.params.id);
  if (!app) throw new ApiError(404, 'Application not found');
  const status = String(req.body.status || app.status).trim();
  app.status = status;
  app.bossNotes = String(req.body.note || app.bossNotes || '');
  app.statusHistory = app.statusHistory || [];
  app.statusHistory.push({ status, by: req.user?.name || 'boss', at: new Date(), note: req.body.note || '' });
  await app.save();
  res.json({ success: true, data: app });
});

exports.updateEligibilityForBoss = asyncHandler(async (req, res) => {
  const app = await PublicLoanApplication.findById(req.params.id);
  if (!app) throw new ApiError(404, 'Application not found');
  app.eligibleBanks = Array.isArray(req.body.eligibleBanks) ? req.body.eligibleBanks.filter(Boolean) : [];
  app.bossNotes = String(req.body.bossNotes || app.bossNotes || '');
  await app.save();
  res.json({ success: true, data: app });
});

exports.deleteForBoss = asyncHandler(async (req, res) => {
  const app = await PublicLoanApplication.findById(req.params.id);
  if (!app) throw new ApiError(404, 'Application not found');
  const folder = path.join(__dirname, '..', '..', 'uploads', 'public-loans', String(app._id));
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  await app.deleteOne();
  res.json({ success: true, data: { deleted: true } });
});

exports.ensureApplicationAccess = asyncHandler(requireApplicationAccess);
