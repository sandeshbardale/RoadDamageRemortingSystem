const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Supabase PostgreSQL connected successfully via Prisma');
  } catch (error) {
    console.error('❌ Supabase PostgreSQL connection error:', error.message);
  }
};

module.exports = { prisma, connectDB };
