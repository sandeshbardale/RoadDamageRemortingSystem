require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Complaint = require('../src/models/Complaint');

const URL_MAP = {
  '/uploads/seed-pothole.jpg':        '/uploads/seed-pothole.svg',
  '/uploads/seed-crack.jpg':          '/uploads/seed-crack.svg',
  '/uploads/seed-waterlogging.jpg':   '/uploads/seed-waterlogging.svg',
  '/uploads/seed-edge-failure.jpg':   '/uploads/seed-edge-failure.svg',
  '/uploads/seed-surface-damage.jpg': '/uploads/seed-surface-damage.svg',
  '/uploads/seed-other.jpg':          '/uploads/seed-other.svg',
};

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  let total = 0;
  for (const [oldUrl, newUrl] of Object.entries(URL_MAP)) {
    const r = await Complaint.updateMany(
      { 'image.url': oldUrl },
      { $set: { 'image.url': newUrl, 'image.publicId': newUrl.split('/').pop() } }
    );
    if (r.modifiedCount > 0) {
      console.log(`Updated ${r.modifiedCount}: ${oldUrl} → ${newUrl}`);
      total += r.modifiedCount;
    }
  }
  console.log(`Done — ${total} complaints updated`);
  await mongoose.disconnect();
  process.exit(0);
}
migrate().catch(e => { console.error(e.message); process.exit(1); });
