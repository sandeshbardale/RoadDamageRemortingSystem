require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const rateLimit = require('express-rate-limit');

const { prisma, connectDB } = require('./config/prisma');
const { errorHandler } = require('./middleware/errorHandler');
const { error } = require('./utils/apiResponse');

// Route imports
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const municipalRoutes = require('./routes/municipalRoutes');

// ─── Connect to Supabase PostgreSQL ──────────────────────────────────────────
connectDB();

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
// Disable CSP and contentSniffing restrictions so local /uploads images load in browser
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,        // allow images from any origin during development
  crossOriginEmbedderPolicy: false,    // allow embedded resources
}));

const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Serve locally-stored images ─────────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://road-damage-system.vercel.app',
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
    : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── HTTP logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Root route ─────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    dbStatus = 'disconnected';
  }

  res.json({
    success: true,
    message: 'Road Damage Reporting API is online and running!',
    health: '/api/health',
    version: '1.0.0',
    database: dbStatus,
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  let isConnected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    dbStatus = 'disconnected';
    isConnected = false;
  }

  res.json({
    success: true,
    message: 'Road Damage Reporting API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      status: dbStatus,
      connected: isConnected,
      provider: 'Supabase PostgreSQL',
    },
  });
});

// ─── DB Readiness Middleware for API endpoints ───────────────────────────────
app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.method === 'OPTIONS') return next();
  try {
    await prisma.$queryRaw`SELECT 1`;
    next();
  } catch (err) {
    return error(
      res,
      'Database is not connected. Please verify DATABASE_URL in Render environment settings.',
      503,
      'DATABASE_NOT_READY'
    );
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/municipal', municipalRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  error(res, `Route ${req.method} ${req.originalUrl} not found.`, 404, 'NOT_FOUND');
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Road Damage Reporting API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw err;
});

module.exports = app; // for testing
