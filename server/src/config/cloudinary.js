const cloudinary = require('cloudinary').v2;
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const isCloudinaryReady = () =>
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_cloud_name' &&
  process.env.CLOUDINARY_API_KEY    !== 'your_cloudinary_api_key';

// ─── Local disk upload (fallback when Cloudinary not configured) ──────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const saveLocally = (buffer, mimeType) => {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const ext      = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  // Return a server-relative URL — served by Express static middleware
  return {
    url:      `/uploads/${filename}`,
    publicId: filename,
    isLocal:  true,
  };
};

// ─── Upload to Cloudinary ─────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder = 'road-damage') => {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    };
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve({ url: result.secure_url, publicId: result.public_id, isLocal: false });
    });
    stream.end(buffer);
  });
};

// ─── Smart upload: Cloudinary if configured, else local disk ─────────────────
const uploadImage = async (buffer, mimeType = 'image/jpeg') => {
  if (isCloudinaryReady()) {
    try {
      return await uploadToCloudinary(buffer, 'road-damage');
    } catch (err) {
      console.error('Cloudinary failed, falling back to local:', err.message);
    }
  }
  console.log('Saving image locally (Cloudinary not configured).');
  return saveLocally(buffer, mimeType);
};

// ─── Delete (Cloudinary or local) ────────────────────────────────────────────
const deleteImage = async (publicId, isLocal = false) => {
  if (!publicId) return;
  if (isLocal) {
    const fp = path.join(UPLOADS_DIR, publicId);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = { uploadImage, deleteImage, uploadToCloudinary, isCloudinaryReady };
