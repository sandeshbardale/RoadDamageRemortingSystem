require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/server');

let adminToken = '';
let citizenToken = '';
let complaintId = '';
let complaintMongoId = '';

beforeAll(async () => {
  // Wait for DB connection
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ── Health check ─────────────────────────────────────────────────────────────
describe('Health Check', () => {
  it('GET /api/health should return 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── Authentication ────────────────────────────────────────────────────────────
describe('Authentication', () => {
  const testEmail = `test_${Date.now()}@test.com`;

  it('POST /api/auth/register — success', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: testEmail,
      password: 'Test@12345',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
    citizenToken = res.body.data.token;
  });

  it('POST /api/auth/register — duplicate email should fail', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User 2',
      email: testEmail,
      password: 'Test@12345',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login — valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'Test@12345',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
    citizenToken = res.body.data.token;
  });

  it('POST /api/auth/login — invalid password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/auth/me — with valid token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('GET /api/auth/me — without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/login as admin', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@roaddamage.local',
      password: 'Admin@12345',
    });
    if (res.statusCode === 200) {
      adminToken = res.body.data.token;
      expect(res.body.data.user.role).toBe('admin');
    } else {
      console.warn('Admin user not seeded yet — skipping admin tests');
    }
  });
});

// ── Complaint creation ────────────────────────────────────────────────────────
describe('Complaint API', () => {
  it('POST /api/complaints/check-duplicate — valid request', async () => {
    const res = await request(app)
      .post('/api/complaints/check-duplicate')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ latitude: 18.5204, longitude: 73.8567, damageCategory: 'POTHOLE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('isDuplicate');
  });

  it('POST /api/complaints/check-duplicate — invalid coords', async () => {
    const res = await request(app)
      .post('/api/complaints/check-duplicate')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ latitude: 999, longitude: 73.8567, damageCategory: 'POTHOLE' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/complaints/nearby — without auth (public)', async () => {
    const res = await request(app)
      .get('/api/complaints/nearby?latitude=18.5204&longitude=73.8567&radius=1000');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('complaints');
  });

  it('GET /api/complaints/map — public', async () => {
    const res = await request(app).get('/api/complaints/map');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data.complaints)).toBe(true);
  });

  it('GET /api/complaints/my — requires auth', async () => {
    const res = await request(app).get('/api/complaints/my');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/complaints/my — with citizen token', async () => {
    const res = await request(app).get('/api/complaints/my')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('complaints');
  });
});

// ── Admin API ─────────────────────────────────────────────────────────────────
describe('Admin API', () => {
  it('GET /api/admin/dashboard — requires admin', async () => {
    const res = await request(app).get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/dashboard — with admin token', async () => {
    if (!adminToken) return;
    const res = await request(app).get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('totalComplaints');
  });

  it('GET /api/admin/analytics — admin only', async () => {
    if (!adminToken) return;
    const res = await request(app).get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('statusDistribution');
  });

  it('GET /api/admin/complaints — admin only', async () => {
    if (!adminToken) return;
    const res = await request(app).get('/api/admin/complaints')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data.complaints)).toBe(true);

    if (res.body.data.complaints.length > 0) {
      complaintMongoId = res.body.data.complaints[0]._id;
      complaintId = res.body.data.complaints[0].complaintId;
    }
  });

  it('PATCH /api/admin/complaints/:id/status — citizen should be forbidden', async () => {
    if (!complaintMongoId) return;
    const res = await request(app)
      .patch(`/api/admin/complaints/${complaintMongoId}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'RECEIVED' });
    expect(res.statusCode).toBe(403);
  });
});

// ── GIS validation ────────────────────────────────────────────────────────────
describe('GIS Validation', () => {
  it('Nearby search with invalid coordinates', async () => {
    const res = await request(app).get('/api/complaints/nearby?latitude=999&longitude=73');
    expect(res.statusCode).toBe(400);
  });

  it('Nearby search with valid coordinates', async () => {
    const res = await request(app).get('/api/complaints/nearby?latitude=18.5204&longitude=73.8567');
    expect(res.statusCode).toBe(200);
  });
});
