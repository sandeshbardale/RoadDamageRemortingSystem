require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/config/prisma');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

const PLACEHOLDER_JPEGS = {
  POTHOLE:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACAgJ/8QAHhAAAQQCAwEAAAAAAAAAAAAAAQIDBBESBSEx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKzpukpRjqBW6N2mFIiLFAAAA/9k=',
  CRACK:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACQoL/8QAHxAAAQQCAwEAAAAAAAAAAAAAAQIDBAUSERMhMf/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALeyrNuqIjHJhqBEFJkAAAA/9k=',
  WATERLOGGING:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACgsM/8QAIBAAAQQCAwEAAAAAAAAAAAAAAQIDBBESBSExQf/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AK/aziqMjJqFjxRJAAAA/9k=',
  EDGE_FAILURE:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACwwN/8QAIRAAAQQCAwEAAAAAAAAAAAAAAQIDBBESBSExQlH/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKyI7SqijRjMoAAAA/9k=',
  SURFACE_DAMAGE:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACg0O/8QAIRAAAQQCAwEAAAAAAAAAAAAAAQIDBBEFBiExQlL/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKqyaTqHRjQAAAA/9k=',
  OTHER:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAACxAR/8QAIRAAAQQCAwEAAAAAAAAAAAAAAQIDBAUGEhEhMUL/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALYhJqlRjQAAAA/9k=',
};

const ensurePlaceholder = (category) => {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `seed-${category.toLowerCase().replace('_', '-')}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    const b64 = (PLACEHOLDER_JPEGS[category] || PLACEHOLDER_JPEGS['OTHER']).replace(/\s/g, '');
    fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
  }
  return `/uploads/${filename}`;
};

const MUNICIPAL_CORPS = [
  {
    name: 'Chhatrapati Sambhajinagar Municipal Corporation (DEMO)',
    code: 'CSMC',
    city: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    isDemo: true,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [75.28, 19.84],
          [75.42, 19.84],
          [75.42, 19.94],
          [75.28, 19.94],
          [75.28, 19.84],
        ],
      ],
    },
  },
  {
    name: 'Mumbai Municipal Corporation (DEMO)',
    code: 'MCGM',
    city: 'Mumbai',
    state: 'Maharashtra',
    isDemo: true,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [72.77, 18.89],
          [72.99, 18.89],
          [72.99, 19.26],
          [72.77, 19.26],
          [72.77, 18.89],
        ],
      ],
    },
  },
  {
    name: 'Bengaluru Municipal Corporation (DEMO)',
    code: 'BBMP',
    city: 'Bengaluru',
    state: 'Karnataka',
    isDemo: true,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [77.45, 12.85],
          [77.78, 12.85],
          [77.78, 13.14],
          [77.45, 13.14],
          [77.45, 12.85],
        ],
      ],
    },
  },
];

const DEMO_COMPLAINTS = [
  {
    damageCategory: 'POTHOLE',
    description: 'Large pothole near Nirala Bazar traffic signal causing frequent flat tyres.',
    lat: 19.8762,
    lon: 75.3433,
    status: 'IN_PROGRESS',
    area: 'Nirala Bazar',
    road: 'Station Road',
  },
  {
    damageCategory: 'CRACK',
    description: 'Wide longitudinal crack on Jalna Road spanning 15 meters.',
    lat: 19.88,
    lon: 75.35,
    status: 'RECEIVED',
    area: 'Cidco',
    road: 'Jalna Road',
  },
  {
    damageCategory: 'WATERLOGGING',
    description: 'Road gets flooded near Osmanpura every time it rains. Drainage blocked.',
    lat: 19.87,
    lon: 75.34,
    status: 'REPORTED',
    area: 'Osmanpura',
    road: 'Dr Babasaheb Road',
  },
  {
    damageCategory: 'EDGE_FAILURE',
    description: 'Road edge crumbling on Aurangpura main road. Vehicles lose balance at the edge.',
    lat: 19.885,
    lon: 75.33,
    status: 'RESOLVED',
    area: 'Aurangpura',
    road: 'Aurangpura Main Road',
  },
  {
    damageCategory: 'SURFACE_DAMAGE',
    description: 'Entire road surface deteriorated near Kranti Chowk. Rough and uneven.',
    lat: 19.872,
    lon: 75.345,
    status: 'CLOSED',
    area: 'Kranti Chowk',
    road: 'Kranti Chowk Road',
  },
  {
    damageCategory: 'POTHOLE',
    description: 'Multiple potholes near Garkheda school zone. Dangerous for children.',
    lat: 19.868,
    lon: 75.348,
    status: 'REPORTED',
    area: 'Garkheda',
    road: 'Garkheda Road',
  },
  {
    damageCategory: 'POTHOLE',
    description: 'Deep pothole on Cantonment road. A motorcycle accident already occurred.',
    lat: 19.867,
    lon: 75.346,
    status: 'REPORTED',
    area: 'Cantonment',
    road: 'Cantonment Road',
    isDuplicate: true,
  },
  {
    damageCategory: 'CRACK',
    description: 'Transverse cracks across the full width of Begumpura road.',
    lat: 19.89,
    lon: 75.32,
    status: 'IN_PROGRESS',
    area: 'Begumpura',
    road: 'Begumpura Road',
  },
  {
    damageCategory: 'OTHER',
    description: 'Manhole cover missing near Mondha market. Very dangerous at night.',
    lat: 19.875,
    lon: 75.338,
    status: 'RECEIVED',
    area: 'Mondha',
    road: 'Mondha Market Road',
  },
  {
    damageCategory: 'SURFACE_DAMAGE',
    description: 'Road surface peeling off near Padampura after recent rain.',
    lat: 19.882,
    lon: 75.342,
    status: 'REPORTED',
    area: 'Padampura',
    road: 'Padampura Road',
  },
];

async function seed() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to Supabase PostgreSQL via Prisma');

    for (const cat of Object.keys(PLACEHOLDER_JPEGS)) ensurePlaceholder(cat);
    console.log('✅ Placeholder images written to uploads/');

    // Clear existing data
    await prisma.notification.deleteMany();
    await prisma.complaintStatusHistory.deleteMany();
    await prisma.complaint.deleteMany();
    await prisma.user.deleteMany();
    await prisma.municipalCorporation.deleteMany();
    console.log('🗑️  Cleared existing data');

    // Create Municipal Corporations
    const createdCorps = [];
    for (const corp of MUNICIPAL_CORPS) {
      const c = await prisma.municipalCorporation.create({ data: corp });
      createdCorps.push(c);
    }
    const csmc = createdCorps.find((c) => c.code === 'CSMC');
    console.log(`✅ Created ${createdCorps.length} municipal corporations`);

    // Create Users
    const salt = await bcrypt.genSalt(12);
    const adminPass = await bcrypt.hash('Admin@12345', salt);
    const citizenPass = await bcrypt.hash('Citizen@12345', salt);

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@roaddamage.local',
        password: adminPass,
        phone: '+91-9000000001',
        role: 'admin',
        municipalCorporationId: csmc?.id,
      },
    });

    const citizen1 = await prisma.user.create({
      data: {
        name: 'Demo Citizen',
        email: 'citizen@roaddamage.local',
        password: citizenPass,
        phone: '+91-9000000002',
        role: 'citizen',
      },
    });

    const citizen2 = await prisma.user.create({
      data: {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        password: citizenPass,
        phone: '+91-9000000003',
        role: 'citizen',
      },
    });
    console.log('✅ Users created');

    const citizens = [citizen1, citizen2];
    const createdComplaints = [];

    for (let i = 0; i < DEMO_COMPLAINTS.length; i++) {
      const d = DEMO_COMPLAINTS[i];
      const cid = `RDR-2026-${String(i + 1).padStart(6, '0')}`;
      const usr = citizens[i % 2];
      const img = ensurePlaceholder(d.damageCategory);

      let isDuplicate = false;
      let duplicateOfId = null;
      let duplicateDistance = null;

      if (d.isDuplicate && createdComplaints.length > 0) {
        isDuplicate = true;
        duplicateOfId = createdComplaints[0].id;
        duplicateDistance = 35;
      }

      const complaint = await prisma.complaint.create({
        data: {
          complaintId: cid,
          citizenId: usr.id,
          imageUrl: img,
          imagePublicId: path.basename(img),
          damageCategory: d.damageCategory,
          customDamageType: d.damageCategory === 'OTHER' ? 'Missing Manhole Cover' : null,
          description: d.description,
          latitude: d.lat,
          longitude: d.lon,
          address: {
            formatted: `${d.road}, ${d.area}, Chhatrapati Sambhajinagar, Maharashtra`,
            road: d.road,
            area: d.area,
            city: 'Chhatrapati Sambhajinagar',
            state: 'Maharashtra',
            postcode: '431001',
          },
          municipalCorporationId: csmc?.id,
          assignmentStatus: 'ASSIGNED',
          status: d.status,
          isDuplicate,
          duplicateOfId,
          duplicateDistance,
          aiAnalysis: {
            available: true,
            detectedCategory: d.damageCategory,
            confidence: 91,
            damageLabel: d.damageCategory,
            severity: 'Medium',
            estimatedSize: 'Medium (30-100cm)',
            safetyRisk: 'Moderate Risk',
            recommendedAction: 'Patch repair within 7 days',
            urgency: 'Standard',
            additionalNotes: 'Seeded demo damage record',
            analyzedAt: new Date().toISOString(),
          },
        },
      });

      createdComplaints.push(complaint);

      await prisma.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          previousStatus: null,
          newStatus: d.status,
          changedById: usr.id,
          comment: 'Initial complaint seeded.',
        },
      });
    }

    console.log(`✅ Seeded ${createdComplaints.length} complaints`);
    console.log('\n=======================================');
    console.log('  Seeding completed successfully!');
    console.log('  Admin login:   admin@roaddamage.local / Admin@12345');
    console.log('  Citizen login: citizen@roaddamage.local / Citizen@12345');
    console.log('=======================================\n');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
