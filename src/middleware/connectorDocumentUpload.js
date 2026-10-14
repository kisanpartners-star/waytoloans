const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const documentDirectory = path.join(__dirname, '..', '..', 'private-uploads', 'connector-documents');
const allowed = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdirSync(documentDirectory, { recursive: true });
    callback(null, documentDirectory);
  },
  filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowed[file.mimetype]?.includes(extension)) return callback(null, true);
  callback(new ApiError(422, 'Upload documents as PDF, JPG or PNG files and property videos as MP4 or WebM'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 25 },
}).array('documents', 25);

module.exports = { upload, documentDirectory };
