require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs   = require('fs');
const path = require('path');

const User                   = require('../src/models/User');
const Complaint              = require('../src/models/Complaint');
const MunicipalCorporation   = require('../src/models/MunicipalCorporation');
const ComplaintStatusHistory = require('../src/models/ComplaintStatusHistory');
const Notification           = require('../src/models/Notification');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

// ─── Minimal valid JPEG placeholders (solid colour, no network needed) ────────
// Each string is a real base64-encoded 4×4 pixel JPEG — fully decodable.
const PLACEHOLDER_JPEGS = {
  POTHOLE:        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACAgJ/8QAHhAAAQQCAwEAAAAAAAAAAAAAAQIDBBESBSEx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKzpukpRjqBW6N2mFIiLFAAAA/9k=',
  CRACK:          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACQoL/8QAHxAAAQQCAwEAAAAAAAAAAAAAAQIDBAUSERMhMf/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALeyrNuqIjHJhqBEFJkAAAA/9k=',
  WATERLOGGING:   '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACgsM/8QAIBAAAQQCAgMAAAAAAAAAAAAAAQIDBBESBSExQf/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AK/aziqMjJqFjxRJAAAA/9k=',
  EDGE_FAILURE:   '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACwwN/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBESBSExQlH/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKyI7SqijRjMoAAAA/9k=',
  SURFACE_DAMAGE: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACg0O/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBEFBiExQlL/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKqyaTqHRjQAAAA/9k=',
  OTHER:          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU FBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACxAR/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBAUGEhEhMUL/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALYhJqlRjQAAAA/9k=',
};

const ensurePlaceholder = (category) => {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `seed-${category.toLowerCase().replace('_','-')}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    const b64 = (PLACEHOLDER_JPEGS[category] || PLACEHOLDER_JPEGS['OTHER']).replace(/\s/g, '');
    fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
  }
  return `/uploads/${filename}`;
};

// ─── Municipal boundaries (DEMO ONLY — not official) ─────────────────────────
// Chhatrapati Sambhajinagar (formerly Aurangabad), Maharashtra
const MUNICIPAL_CORPS = [
  {
    name:'Chhatrapati Sambhajinagar Municipal Corporation (DEMO)',
    code:'CSMC',
    city:'Chhatrapati Sambhajinagar',
    state:'Maharashtra',
    isDemo:true,
    // Approximate bounding polygon for Chhatrapati Sambhajinagar — DEMO ONLY
    boundary:{ type:'Polygon', coordinates:[[[75.28,19.84],[75.42,19.84],[75.42,19.94],[75.28,19.94],[75.28,19.84]]] }
  },
  {
    name:'Mumbai Municipal Corporation (DEMO)',
    code:'MCGM',
    city:'Mumbai',
    state:'Maharashtra',
    isDemo:true,
    boundary:{ type:'Polygon', coordinates:[[[72.77,18.89],[72.99,18.89],[72.99,19.26],[72.77,19.26],[72.77,18.89]]] }
  },
  {
    name:'Bengaluru Municipal Corporation (DEMO)',
    code:'BBMP',
    city:'Bengaluru',
    state:'Karnataka',
    isDemo:true,
    boundary:{ type:'Polygon', coordinates:[[[77.45,12.85],[77.78,12.85],[77.78,13.14],[77.45,13.14],[77.45,12.85]]] }
  },
];

// Real roads in Chhatrapati Sambhajinagar
const DEMO_COMPLAINTS = [
  { damageCategory:'POTHOLE',        description:'Large pothole near Nirala Bazar traffic signal causing frequent flat tyres.',       lat:19.8762, lon:75.3433, status:'IN_PROGRESS', area:'Nirala Bazar',    road:'Station Road'         },
  { damageCategory:'CRACK',          description:'Wide longitudinal crack on Jalna Road spanning 15 meters.',                         lat:19.8800, lon:75.3500, status:'RECEIVED',    area:'Cidco',            road:'Jalna Road'            },
  { damageCategory:'WATERLOGGING',   description:'Road gets flooded near Osmanpura every time it rains. Drainage blocked.',           lat:19.8700, lon:75.3400, status:'REPORTED',    area:'Osmanpura',        road:'Dr Babasaheb Road'     },
  { damageCategory:'EDGE_FAILURE',   description:'Road edge crumbling on Aurangpura main road. Vehicles lose balance at the edge.',   lat:19.8850, lon:75.3300, status:'RESOLVED',    area:'Aurangpura',       road:'Aurangpura Main Road'  },
  { damageCategory:'SURFACE_DAMAGE', description:'Entire road surface deteriorated near Kranti Chowk. Rough and uneven.',             lat:19.8720, lon:75.3450, status:'CLOSED',      area:'Kranti Chowk',     road:'Kranti Chowk Road'     },
  { damageCategory:'POTHOLE',        description:'Multiple potholes near Garkheda school zone. Dangerous for children.',              lat:19.8680, lon:75.3480, status:'REPORTED',    area:'Garkheda',         road:'Garkheda Road'         },
  { damageCategory:'POTHOLE',        description:'Deep pothole on Cantonment road. A motorcycle accident already occurred.',          lat:19.8670, lon:75.3460, status:'REPORTED',    area:'Cantonment',       road:'Cantonment Road',       isDuplicate:true },
  { damageCategory:'CRACK',          description:'Transverse cracks across the full width of Begumpura road.',                        lat:19.8900, lon:75.3200, status:'IN_PROGRESS', area:'Begumpura',        road:'Begumpura Road'        },
  { damageCategory:'OTHER',          description:'Manhole cover missing near Mondha market. Very dangerous at night.',                lat:19.8750, lon:75.3380, status:'RECEIVED',    area:'Mondha',           road:'Mondha Market Road'    },
  { damageCategory:'SURFACE_DAMAGE', description:'Road surface peeling off near Padampura after recent rain.',                       lat:19.8820, lon:75.3420, status:'REPORTED',    area:'Padampura',        road:'Padampura Road'        },
];

const STATUS_FLOW = {
  REPORTED:    ['REPORTED'],
  RECEIVED:    ['REPORTED','RECEIVED'],
  IN_PROGRESS: ['REPORTED','RECEIVED','IN_PROGRESS'],
  RESOLVED:    ['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED'],
  CLOSED:      ['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED'],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Write placeholder images to disk
    for (const cat of Object.keys(PLACEHOLDER_JPEGS)) ensurePlaceholder(cat);
    console.log('✅ Placeholder images written to uploads/');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Complaint.deleteMany({}),
      MunicipalCorporation.deleteMany({}),
      ComplaintStatusHistory.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Municipal corporations
    const corps = await MunicipalCorporation.insertMany(MUNICIPAL_CORPS);
    const csmc  = corps.find(c => c.code === 'CSMC'); // Chhatrapati Sambhajinagar Municipal Corporation
    console.log(`✅ Created ${corps.length} municipal corporations`);

    // Users
    const adminUser = await User.create({ name:'Admin User', email:'admin@roaddamage.local', password:'Admin@12345', phone:'+91-9000000001', role:'admin', municipalCorporationId:csmc._id });
    const citizen1  = await User.create({ name:'Demo Citizen', email:'citizen@roaddamage.local', password:'Citizen@12345', phone:'+91-9000000002', role:'citizen' });
    const citizen2  = await User.create({ name:'Rahul Sharma',  email:'rahul@example.com',        password:'Citizen@12345', phone:'+91-9000000003', role:'citizen' });
    console.log('✅ Users created');

    // Complaints
    const citizens  = [citizen1, citizen2];
    const created   = [];
    const severities = ['Low','Medium','High','Critical'];
    const sizes      = ['Small (<30cm)','Medium (30-100cm)','Large (>100cm)'];

    for (let i = 0; i < DEMO_COMPLAINTS.length; i++) {
      const d   = DEMO_COMPLAINTS[i];
      const cid = `RDR-2026-${String(i+1).padStart(6,'0')}`;
      const usr = citizens[i % 2];
      const img = ensurePlaceholder(d.damageCategory);

      let isDuplicate=false, duplicateOf=null, duplicateDistance=null;
      if (d.isDuplicate && created.length > 0) { isDuplicate=true; duplicateOf=created[0]._id; duplicateDistance=35; }

      const complaint = await Complaint.create({
        complaintId: cid, citizenId: usr._id,
        image: { url: img, publicId: path.basename(img) },
        damageCategory: d.damageCategory,
        customDamageType: d.damageCategory === 'OTHER' ? 'Missing Manhole Cover' : null,
        description: d.description,
        location: { type:'Point', coordinates:[d.lon, d.lat] },
        address: { 
          formatted: `${d.road}, ${d.area}, Chhatrapati Sambhajinagar, Maharashtra 431001, India`,
          road: d.road,
          area: d.area,
          city: 'Chhatrapati Sambhajinagar',
          state: 'Maharashtra',
          postcode: '431001'
        },
        municipalCorporationId: csmc._id, assignmentStatus:'ASSIGNED',
        status: d.status, isDuplicate, duplicateOf, duplicateDistance,
        aiAnalysis: {
          available: true,
          severity:          severities[i % 4],
          damageType:        d.damageCategory.replace(/_/g,' ').toLowerCase(),
          estimatedSize:     sizes[i % 3],
          safetyRisk:        i % 3 === 0 ? 'Yes — immediate hazard for two-wheelers' : 'No — monitor closely',
          recommendedAction: i % 2 === 0 ? 'Immediate patching required within 24 hours' : 'Schedule repair within 7 days',
          additionalNotes:   'Demo AI analysis generated during database seeding.',
          analyzedAt:        new Date().toISOString(),
        },
      });
      created.push(complaint);

      // Status history
      const statuses = STATUS_FLOW[d.status] || ['REPORTED'];
      let prev = null;
      const base = new Date(); base.setDate(base.getDate() - (DEMO_COMPLAINTS.length - i) * 3);
      for (let j = 0; j < statuses.length; j++) {
        const dt = new Date(base); dt.setDate(dt.getDate() + j * 2);
        await ComplaintStatusHistory.create({
          complaintId:complaint._id, previousStatus:prev, newStatus:statuses[j],
          changedBy: j===0 ? usr._id : adminUser._id,
          comment:   j===0 ? 'Complaint submitted by citizen.' : `Status updated to ${statuses[j]}.`,
          createdAt: dt,
        });
        prev = statuses[j];
      }

      // Notification
      const notifs = {
        REPORTED:    { title:'Complaint Submitted',  message:`Your complaint ${cid} has been received.`,   type:'COMPLAINT_RECEIVED' },
        IN_PROGRESS: { title:'Work In Progress',     message:`Your complaint ${cid} is now In Progress.`, type:'STATUS_UPDATE'      },
        RESOLVED:    { title:'Complaint Resolved',   message:`Your complaint ${cid} has been resolved.`,  type:'COMPLAINT_RESOLVED' },
      };
      if (notifs[d.status]) await Notification.create({ userId:usr._id, complaintId:complaint._id, ...notifs[d.status] });
    }

    console.log(`✅ Created ${created.length} demo complaints with local images`);
    console.log('\n====================================================');
    console.log('🌱 Database seeded successfully!');
    console.log('====================================================');
    console.log('   Admin:   admin@roaddamage.local  / Admin@12345');
    console.log('   Citizen: citizen@roaddamage.local / Citizen@12345');
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
