const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const EMPLOYEE_IMAGES = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
};
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});
const fileFilter = (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new ApiError(422, 'Only PNG, JPG or WEBP images are allowed')));
exports.imageUpload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024, files: 2 } });
const employeeStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const employeeFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EMPLOYEE_IMAGES[ext]?.includes(file.mimetype.toLowerCase())) return cb(null, true);
  cb(new ApiError(422, 'Upload a PNG, JPG, JPEG, WEBP or SVG image'));
};
exports.employeePhotoUpload = multer({
  storage: employeeStorage,
  fileFilter: employeeFileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
exports.publicPath = (file) => `/uploads/${file.filename}`;
