const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});
const fileFilter = (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new ApiError(422, 'Only PNG, JPG or WEBP images are allowed')));
exports.imageUpload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024, files: 2 } });
exports.publicPath = (file) => `/uploads/${file.filename}`;
