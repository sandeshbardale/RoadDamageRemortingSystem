const multer = require('multer');
const { error } = require('../utils/apiResponse');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 5 * 1024 * 1024; // 5MB

// Use memory storage — buffer is passed to Cloudinary directly
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(`Invalid file type. Allowed types: JPG, JPEG, PNG, WEBP`),
      false
    );
  }

  // Validate extension — never trust filename alone, but add as extra check
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE,
    files: 1,
  },
});

/**
 * Middleware that handles multer errors gracefully
 */
const handleUpload = (fieldName) => (req, res, next) => {
  const uploader = upload.single(fieldName);
  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return error(res, `File too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB.`, 400, 'FILE_TOO_LARGE');
      }
      return error(res, `Upload error: ${err.message}`, 400, 'UPLOAD_ERROR');
    } else if (err) {
      return error(res, err.message, 400, 'INVALID_FILE');
    }
    next();
  });
};

module.exports = { handleUpload };
