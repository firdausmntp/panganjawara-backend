// Vercel Serverless Entry Point
// This file wraps the Express app for Vercel deployment

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Use Supabase config for Vercel
const { initDatabase, getSupabase, closePool } = require('../config/supabase');
const {
  createUsersTable,
  createPostsTable,
  createCommentsTable,
  createArticlesTable,
  createVideosTable,
  createEventsTable,
  createImagesTable,
  createStatisticsTable,
  createWilayahTable,
  createApiKeyUsageTable
} = require('../utils/dbHelperPg');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database pool (will be initialized on first request)
let dbPool = null;
let isInitialized = false;

// Initialize database on first request
async function ensureDbInitialized() {
  if (isInitialized) return dbPool;
  
  try {
    dbPool = await initDatabase();
    
    // Create tables if not exist
    await createUsersTable(dbPool);
    await createPostsTable(dbPool);
    await createCommentsTable(dbPool);
    await createArticlesTable(dbPool);
    await createVideosTable(dbPool);
    await createEventsTable(dbPool);
    await createImagesTable(dbPool);
    await createStatisticsTable(dbPool);
    await createWilayahTable(dbPool);
    await createApiKeyUsageTable(dbPool);
    
    isInitialized = true;
    console.log('Database initialized for Vercel');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
  
  return dbPool;
}

// Middleware to ensure DB is ready
app.use(async (req, res, next) => {
  try {
    req.db = await ensureDbInitialized();
    req.supabase = getSupabase();
    next();
  } catch (error) {
    console.error('DB middleware error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'vercel',
    database: isInitialized ? 'connected' : 'not connected'
  });
});

app.get('/pajar/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'vercel',
    database: isInitialized ? 'connected' : 'not connected'
  });
});

// Root documentation
app.get(['/', '/pajar', '/api'], (req, res) => {
  const baseUrl = `https://${req.get('host')}/pajar`;
  
  res.json({
    name: "Pangan Jawara API - Vercel Edition",
    version: "2.0.0",
    description: "REST API deployed on Vercel with Supabase PostgreSQL",
    baseUrl: baseUrl,
    database: "Supabase PostgreSQL",
    storage: "Supabase Storage",
    
    endpoints: {
      health: `${baseUrl}/health`,
      auth: `${baseUrl}/auth/*`,
      posts: `${baseUrl}/posts/*`,
      articles: `${baseUrl}/articles/*`,
      videos: `${baseUrl}/videos/*`,
      events: `${baseUrl}/events/*`,
      pangan: `${baseUrl}/pangan/*`,
      bmkg: `${baseUrl}/bmkg/*`,
      nekolabs: `${baseUrl}/nekolabs/*`
    },
    
    features: [
      "🚀 Serverless deployment on Vercel",
      "🐘 PostgreSQL via Supabase",
      "📦 Supabase Storage for uploads",
      "🔐 JWT Authentication",
      "🌐 CORS enabled"
    ]
  });
});

// Import route creators
const createPostRoutes = require('../routes/posts');
const createCommentRoutes = require('../routes/comments');
const createAuthRoutes = require('../routes/auth');
const createArticleRoutes = require('../routes/articles');
const createVideoRoutes = require('../routes/videos');
const createPublicArticleRoutes = require('../routes/publicArticles');
const createPublicVideoRoutes = require('../routes/publicVideos');
const createPublicPostRoutes = require('../routes/publicPosts');
const createStatsRoutes = require('../routes/stats');
const createEventRoutes = require('../routes/events');
const createWilayahRoutes = require('../routes/wilayah');
const createPanganRoutes = require('../routes/pangan');
const createBmkgRoutes = require('../routes/bmkg');

// Check if nekolabs routes exist
let createNekolabsRoutes;
try {
  createNekolabsRoutes = require('../routes/nekolabs');
} catch (e) {
  console.log('Nekolabs routes not found, skipping...');
}

// Route factory - creates routes with db injection
function mountRoutes(basePath = '/pajar') {
  // Routes that need db from request
  app.use(`${basePath}/posts`, (req, res, next) => {
    const router = createPostRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}`, (req, res, next) => {
    const router = createCommentRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/auth`, (req, res, next) => {
    const router = createAuthRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/articles`, (req, res, next) => {
    const router = createArticleRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/videos`, (req, res, next) => {
    const router = createVideoRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/public/articles`, (req, res, next) => {
    const router = createPublicArticleRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/public/videos`, (req, res, next) => {
    const router = createPublicVideoRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/public/posts`, (req, res, next) => {
    const router = createPublicPostRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/stats`, (req, res, next) => {
    const router = createStatsRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/events`, (req, res, next) => {
    const router = createEventRoutes(req.db);
    router(req, res, next);
  });
  
  app.use(`${basePath}/wilayah`, (req, res, next) => {
    const router = createWilayahRoutes(req.db);
    router(req, res, next);
  });
  
  // Proxy routes (no db needed)
  app.use(`${basePath}/pangan`, createPanganRoutes());
  app.use(`${basePath}/bmkg`, createBmkgRoutes());
  
  if (createNekolabsRoutes) {
    app.use(`${basePath}/nekolabs`, createNekolabsRoutes);
  }
}

// Mount all routes
mountRoutes('/pajar');

// Also mount at root for flexibility
mountRoutes('');

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Export for Vercel
module.exports = app;
