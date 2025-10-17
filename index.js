const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const geoip = require('geoip-lite');
const { initDatabase, getPool, closePool } = require('./config/database');
const EnvironmentConfig = require('./utils/environmentConfig');
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
  createApiKeyUsageTable,
  incrementApiKeyUsage,
  pickAvailableApiKey
} = require('./utils/dbHelper');
const axios = require('axios');
// Load environment variables
dotenv.config();

// Initialize environment configuration
const envConfig = new EnvironmentConfig();

// Inisialisasi express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve uploaded files statically - environment aware
const staticConfig = envConfig.getStaticConfig();
app.use(staticConfig.route, express.static(staticConfig.directory));

// Debug info for environment
console.log('Environment Configuration:', envConfig.getConfigSummary());

// Routes akan di-mount setelah koneksi DB siap.
let dbPool; // akan diisi setelah init (connection pool)

// Route default - environment aware documentation
const basePath = envConfig.getApiBasePath();
app.get(basePath === '' ? '/' : basePath, (req, res) => {
  // Force /pajar base URL for hosted environment
  const baseUrl = `https://${req.get('host')}/pajar`;
  
  // Check if client wants JSON or HTML
  const acceptHeader = req.get('Accept') || '';
  if (acceptHeader.includes('application/json') || req.query.format === 'json') {
    // Return JSON documentation
    res.json({
      name: "Pangan Jawara API with Multi-Image Support",
      version: "1.0.0",
      description: "Comprehensive REST API for managing posts, comments, and articles with admin authentication, image uploads, and analytics",
      baseUrl: baseUrl,
      
      features: [
        "🌐 Public Content Creation - Anyone can create posts and comments with images",
        "🔐 Admin Authentication - JWT-based authentication for content management", 
        "📝 Post Management - Public creation, admin moderation with view & like tracking",
        "💬 Comment System - Public commenting with admin moderation and likes",
        "📰 Article System - CMS-like article management (admin-only) with view & like tracking",
        "🖼️ Multi-Image Upload - Support for multiple images per content",
        "❤️ Like System - Like/unlike functionality for posts, articles, and comments",
        "🔗 Zoom Integration - Direct Zoom meeting links and details for events",
        "📊 Analytics - Comprehensive statistics with geolocation, views, and likes tracking",
        "🌍 Geolocation Service - IP location tracking",
        "📈 Popular Content - View and like-based ranking for posts and articles",
        "🚀 Environment Aware - Automatic path configuration for different deployments"
      ],

      authentication: {
        description: "JWT-based authentication for admin operations",
        defaultAdmin: {
          username: "admin",
          password: "admin123",
          note: "⚠️ Change password immediately after first login!"
        }
      },

      uploadSpecs: {
        supportedFormats: ["JPEG", "JPG", "PNG", "GIF", "WebP"],
        maxFileSize: "5MB per image",
        maxImagesPerPost: 10,
        maxImagesPerComment: 5,
        maxImagesPerArticle: 10,
        storageAccess: `${baseUrl}${staticConfig.route.replace(basePath, '')}/filename.ext`,
        environment: {
          deployment: envConfig.isSubdirectoryDeployment ? 'subdirectory' : 'root',
          staticRoute: staticConfig.route,
          apiBasePath: basePath
        }
      },

      endpoints: {
        system: {
          description: "System & utility endpoints (no authentication required)",
          routes: {
            [`GET ${baseUrl}/`]: "This documentation",
            [`GET ${baseUrl}/health`]: "Health check & server status",
            [`GET ${baseUrl}/location`]: "IP geolocation service (query: ?ip=x.x.x.x)"
          }
        },

        authentication: {
          description: "Admin authentication system",
          baseRoute: `${basePath}/auth`,
          routes: {
            [`POST ${baseUrl}/auth/login`]: {
              description: "Admin login",
              body: { username: "admin", password: "admin123" },
              response: "JWT token for authenticated requests"
            },
            [`GET ${baseUrl}/auth/profile`]: {
              description: "Get admin profile",
              auth: "required",
              headers: { "Authorization": "Bearer YOUR_JWT_TOKEN" }
            },
            [`PUT ${baseUrl}/auth/change-password`]: {
              description: "Change admin password", 
              auth: "required",
              body: { currentPassword: "old_pass", newPassword: "new_pass" }
            },
            [`POST ${baseUrl}/auth/create-user`]: {
              description: "Create new admin user",
              auth: "superadmin_only",
              body: { username: "newadmin", password: "password", email: "admin@example.com", role: "admin" }
            },
            [`GET ${baseUrl}/auth/users`]: {
              description: "Get all users list",
              auth: "superadmin_only",
              response: "Array of all users with details"
            }
          }
        },

        posts: {
          description: "Blog posts management (public creation, admin moderation)",
          baseRoute: `${baseUrl}/posts`,
          routes: {
            [`GET ${baseUrl}/posts`]: {
              description: "Get all posts",
              auth: "public",
              response: "Array of posts with image counts and view stats"
            },
            [`GET ${baseUrl}/posts/:id`]: {
              description: "Get specific post by ID with view tracking",
              auth: "public",
              response: "Post details with associated images"
            },
            [`POST ${baseUrl}/posts`]: {
              description: "Create new post with images",
              auth: "public",
              contentType: "multipart/form-data",
              body: {
                title: "Post title (required)",
                content: "Post content (required)", 
                author: "Author name (required)",
                images: "Multiple image files (optional, max 10)"
              }
            },
            [`PUT ${baseUrl}/posts/:id`]: {
              description: "Update existing post",
              auth: "admin_only",
              contentType: "multipart/form-data"
            },
            [`DELETE ${baseUrl}/posts/:id`]: {
              description: "Delete post",
              auth: "admin_only"
            },
            [`GET ${baseUrl}/posts/:id/stats`]: {
              description: "Get detailed post statistics",
              auth: "admin_only",
              response: "View counts, geographic data, user agents"
            }
          }
        },

        comments: {
          description: "Comment system for posts (public creation, admin moderation)",
          baseRoute: `${baseUrl}`,
          routes: {
            [`GET ${baseUrl}/posts/:post_id/comments`]: {
              description: "Get all comments for a specific post",
              auth: "public",
              response: "Array of comments with image counts"
            },
            [`POST ${baseUrl}/posts/:post_id/comments`]: {
              description: "Create new comment with images",
              auth: "public",
              contentType: "multipart/form-data",
              body: {
                author: "Commenter name (required)",
                content: "Comment content (required)",
                images: "Multiple image files (optional, max 5)"
              }
            },
            [`GET ${baseUrl}/comments`]: {
              description: "Get all comments from all posts",
              auth: "admin_only",
              query: "?limit=50&offset=0 (pagination)",
              response: "Array of all comments with post info and images"
            },
            [`PUT ${baseUrl}/comments/:id`]: {
              description: "Update existing comment",
              auth: "admin_only"
            },
            [`DELETE ${baseUrl}/comments/:id`]: {
              description: "Delete comment", 
              auth: "admin_only"
            }
          }
        },

        articles: {
          description: "CMS article management system (admin-only creation)",
          baseRoute: `${baseUrl}/articles`,
          routes: {
            [`GET ${baseUrl}/articles`]: {
              description: "Get all published articles (public) or all articles (admin)",
              auth: "public",
              query: "?status=published|draft|archived (admin only)"
            },
            [`GET ${baseUrl}/articles/featured`]: {
              description: "Get featured articles only",
              auth: "public"
            },
            [`GET ${baseUrl}/articles/search`]: {
              description: "Search articles by title/content",
              auth: "public", 
              query: "?q=search_term"
            },
            [`GET ${baseUrl}/articles/:id`]: {
              description: "Get specific article with view tracking",
              auth: "public (published only) / admin (all)"
            },
            [`POST ${baseUrl}/articles`]: {
              description: "Create new article",
              auth: "admin_only",
              contentType: "multipart/form-data",
              body: {
                title: "Article title (required)",
                content: "Article HTML content (required)",
                excerpt: "Brief excerpt (optional)",
                author: "Author name (required)",
                status: "draft|published|archived (default: draft)",
                featured: "true|false (default: false)",
                tags: "comma,separated,tags (optional)",
                meta_description: "SEO description (optional)",
                slug: "url-slug (optional, auto-generated)",
                images: "Multiple image files (optional, max 10)"
              }
            },
            [`PUT ${baseUrl}/articles/:id`]: {
              description: "Update existing article",
              auth: "admin_only"
            },
            [`DELETE ${baseUrl}/articles/:id`]: {
              description: "Delete article",
              auth: "admin_only"
            },
            [`GET ${baseUrl}/articles/:id/stats`]: {
              description: "Get article statistics",
              auth: "admin_only"
            }
          }
        },

        videos: {
          description: "YouTube video management (Admin Only) - Full CRUD operations",
          auth: "admin_only",
          note: "For public access to published videos, use /public/videos endpoints",
          endpoints: {
            [`GET ${baseUrl}/videos`]: {
              description: "Get all videos with pagination and filtering",
              auth: "admin_only",
              queryParams: {
                page: "Page number (default: 1)",
                limit: "Results per page (default: 10)",
                status: "Filter by status: draft|published|archived (optional)"
              }
            },
            [`GET ${baseUrl}/videos/featured`]: {
              description: "Get featured videos",
              auth: "admin_only",
              queryParams: {
                limit: "Number of videos (default: 5)"
              }
            },
            [`GET ${baseUrl}/videos/trending`]: {
              description: "Get trending videos (by view count)",
              auth: "admin_only",
              queryParams: {
                limit: "Number of videos (default: 10)"
              }
            },
            [`GET ${baseUrl}/videos/search`]: {
              description: "Search videos by title, description, or tags",
              auth: "admin_only",
              queryParams: {
                q: "Search query (required)",
                page: "Page number (default: 1)",
                limit: "Results per page (default: 10)"
              }
            },
            [`POST ${baseUrl}/videos`]: {
              description: "Create new video",
              auth: "admin_only",
              contentType: "application/json",
              body: {
                title: "Video title (required)",
                description: "Video description (optional)",
                author: "Author name (required)",
                youtube_url: "YouTube video URL (required)",
                status: "draft|published|archived (default: draft)",
                featured: "true|false (default: false)",
                tags: "comma,separated,tags (optional)",
                duration: "Video duration (optional, e.g., '10:30')"
              }
            },
            [`GET ${baseUrl}/videos/:id`]: {
              description: "Get video by ID (increments view count)",
              auth: "admin_only"
            },
            [`PUT ${baseUrl}/videos/:id`]: {
              description: "Update existing video",
              auth: "admin_only"
            },
            [`DELETE ${baseUrl}/videos/:id`]: {
              description: "Delete video",
              auth: "admin_only"
            },
            [`GET ${baseUrl}/videos/:id/stats`]: {
              description: "Get video statistics",
              auth: "admin_only"
            },
            [`POST ${baseUrl}/videos/:id/like`]: {
              description: "Like video (increments like count)",
              auth: "admin_only"
            }
          }
        },

        publicArticles: {
          description: "Public-only access to published articles with no admin privileges",
          baseRoute: `${baseUrl}/public/articles`,
          routes: {
            [`GET ${baseUrl}/public/articles`]: {
              description: "Get all published articles (public only)",
              auth: "public",
              query: "?page=1&limit=10",
              response: "Only published articles, no drafts"
            },
            [`GET ${baseUrl}/public/articles/featured`]: {
              description: "Get featured published articles",
              auth: "public"
            },
            [`GET ${baseUrl}/public/articles/search`]: {
              description: "Search published articles by title/content",
              auth: "public",
              query: "?q=search_term"
            },
            [`GET ${baseUrl}/public/articles/:id`]: {
              description: "Get specific published article (no drafts)",
              auth: "public"
            },
            [`POST ${baseUrl}/public/articles/:id/like`]: {
              description: "Like/unlike an article",
              auth: "public"
            },
            [`GET ${baseUrl}/public/articles/:id/like-status`]: {
              description: "Check if user has liked an article",
              auth: "public"
            }
          }
        },

        publicVideos: {
          description: "Public-only access to published videos with no admin privileges",
          baseRoute: `${baseUrl}/public/videos`,
          routes: {
            [`GET ${baseUrl}/public/videos`]: {
              description: "Get all published videos (public only)",
              auth: "public",
              query: "?page=1&limit=10",
              response: "Only published videos, no drafts or archived"
            },
            [`GET ${baseUrl}/public/videos/featured`]: {
              description: "Get featured published videos",
              auth: "public",
              query: "?limit=5"
            },
            [`GET ${baseUrl}/public/videos/trending`]: {
              description: "Get trending published videos (by view count)",
              auth: "public",
              query: "?limit=10"
            },
            [`GET ${baseUrl}/public/videos/search`]: {
              description: "Search published videos by title/description/tags",
              auth: "public",
              query: "?q=search_term&page=1&limit=10"
            },
            [`GET ${baseUrl}/public/videos/:id`]: {
              description: "Get specific published video (increments view count)",
              auth: "public",
              response: "Returns video with YouTube URL, thumbnail, etc."
            },
            [`POST ${baseUrl}/public/videos/:id/like`]: {
              description: "Like a video (increments like count)",
              auth: "public"
            }
          }
        },

        statistics: {
          description: "Comprehensive analytics system with view tracking",
          baseRoute: `${baseUrl}/stats`, 
          routes: {
            [`GET ${baseUrl}/stats/popular/:type`]: {
              description: "Get popular content by views (public)",
              auth: "public",
              params: "type = posts|articles|all",
              query: "?limit=10 (number of results)",
              response: "Popular content ranked by view counts"
            },
            [`GET ${baseUrl}/stats/dashboard`]: {
              description: "Overall dashboard statistics",
              auth: "admin_only",
              response: "Total counts, recent activity, geographic distribution"
            },
            [`GET ${baseUrl}/stats/content/:type`]: {
              description: "Statistics by content type",
              auth: "admin_only",
              params: "type = post|comment|article"
            },
            [`GET ${baseUrl}/stats/content/:type/:id`]: {
              description: "Detailed statistics for specific content",
              auth: "admin_only"
            },
            [`GET ${baseUrl}/stats/images`]: {
              description: "Image usage statistics",
              auth: "admin_only",
              response: "File sizes, formats, usage counts"
            },
            [`DELETE ${baseUrl}/stats/cleanup`]: {
              description: "Clean old statistics data",
              auth: "admin_only",
              query: "?days=365 (delete stats older than X days)"
            }
          }
        },

        uploads: {
          description: "Static file serving for uploaded images",
          baseRoute: `${baseUrl}/uploads`,
          routes: {
            [`GET ${baseUrl}/uploads/:filename`]: {
              description: "Access uploaded image files",
              auth: "public",
              examples: [
                `${baseUrl}/uploads/uuid-generated-name.jpg`,
                `${baseUrl}/uploads/uuid-generated-name.png`
              ]
            }
          }
        },

        wilayah: {
          description: "Data wilayah Indonesia (provinsi, kab/kota, kecamatan, kelurahan)",
          baseRoute: `${baseUrl}/wilayah`,
          routes: {
            [`GET ${baseUrl}/wilayah/provinsi`]: "Daftar provinsi",
            [`GET ${baseUrl}/wilayah/provinsi/:provCode/kabkota`]: "Daftar kabupaten/kota dalam provinsi",
            [`GET ${baseUrl}/wilayah/provinsi/:provCode/kabkota/:kabCode/kecamatan`]: "Daftar kecamatan",
            [`GET ${baseUrl}/wilayah/provinsi/:provCode/kabkota/:kabCode/kecamatan/:kecCode/kelurahan`]: "Daftar kelurahan/desa",
            [`GET ${baseUrl}/wilayah/kode/:kode`]: "Cari by kode lengkap (contoh: 11.02.05.1001)",
            [`GET ${baseUrl}/wilayah/search?q=term`]: "Cari wilayah by nama/kode"
          }
        }
      },

      examples: {
        quickStart: {
          createPost: `curl -X POST ${baseUrl}/posts \\
  -F "title=My First Post" \\
  -F "content=Hello from the API!" \\
  -F "author=API User" \\
  -F "images=@photo.jpg"`,
          
          adminLogin: `curl -X POST ${baseUrl}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"admin123"}'`,
          
          getStats: `curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  ${baseUrl}/stats/dashboard`
        }
      },

      responseFormats: {
        success: {
          description: "Successful responses",
          example: { message: "Operation successful", data: "..." }
        },
        error: {
          description: "Error responses", 
          example: { error: "Error description" }
        },
        httpCodes: {
          200: "Success",
          201: "Created", 
          400: "Bad Request",
          401: "Unauthorized",
          403: "Forbidden (Admin required)",
          404: "Not Found",
          500: "Internal Server Error"
        }
      },

      deployment: {
        requirements: ["Node.js 14+", "MySQL/MariaDB", "File upload support"],
        environment: "Production ready with proper error handling and security"
      },

      contact: {
        api: baseUrl,
        documentation: `${baseUrl}/`,
        health: `${baseUrl}/health`
      }
    });
  } else {
    // Return beautiful HTML documentation
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pangan Jawara API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism-tomorrow.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            color: #2d3748;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .header p {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 20px;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .content {
            display: grid;
            gap: 25px;
        }
        
        .card {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .card h2 {
            color: #2d3748;
            margin-bottom: 20px;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
        }
        
        .card h2::before {
            content: '';
            width: 4px;
            height: 25px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 2px;
            margin-right: 12px;
        }
        
        .endpoint-group {
            margin-bottom: 25px;
        }
        
        .endpoint-group h3 {
            color: #4a5568;
            margin-bottom: 15px;
            font-size: 1.2rem;
        }
        
        .endpoint {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 0 8px 8px 0;
            transition: all 0.3s ease;
        }
        
        .endpoint:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .endpoint-header {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            margin-bottom: 10px;
            gap: 10px;
        }
        
        .method {
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            font-size: 0.8rem;
        }
        
        .method.GET { background: #48bb78; }
        .method.POST { background: #ed8936; }
        .method.PUT { background: #4299e1; }
        .method.DELETE { background: #f56565; }
        
        .path {
            font-family: 'Courier New', monospace;
            background: #edf2f7;
            padding: 8px 12px;
            border-radius: 6px;
            color: #2d3748;
            flex: 1;
            min-width: 200px;
        }
        
        .auth-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: bold;
        }
        
        .auth-public { background: #c6f6d5; color: #22543d; }
        .auth-admin { background: #fed7d7; color: #742a2a; }
        .auth-superadmin { background: #fbb6ce; color: #97266d; }
        
        .endpoint-description {
            color: #4a5568;
            margin-bottom: 10px;
        }
        
        .try-button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.3s ease;
        }
        
        .try-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .admin-panel {
            background: linear-gradient(135deg, #ff9a9e, #fecfef);
            border: none;
            color: #2d3748;
        }
        
        .test-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .test-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        
        .test-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .test-input {
            padding: 10px;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            font-size: 0.9rem;
        }
        
        .test-result {
            background: #f7fafc;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 0.8rem;
        }
        
        @media (max-width: 768px) {
            .container { padding: 15px; }
            .header { padding: 25px; }
            .header h1 { font-size: 2rem; }
            .card { padding: 20px; }
            .endpoint-header { flex-direction: column; align-items: flex-start; }
            .path { min-width: auto; width: 100%; }
        }
        
        .footer {
            text-align: center;
            padding: 40px 20px;
            color: rgba(255,255,255,0.8);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Pangan Jawara API Documentation</h1>
            <p>Comprehensive REST API with Multi-Image Support & Admin System</p>
            <div class="features">
                <div class="feature">🌐 Public Content Creation</div>
                <div class="feature">🔐 JWT Authentication</div>
                <div class="feature">🖼️ Multi-Image Upload</div>
                <div class="feature">📊 Analytics Dashboard</div>
                <div class="feature">📰 CMS Articles</div>
                <div class="feature">🌍 Geolocation</div>
            </div>
        </div>

        <div class="content">
            <div class="card">
                <h2>🔗 Quick Access</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/health</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/health')">Try It</button>
                        </div>
                        <div class="endpoint-description">Health check & server status</div>
                    </div>
                    
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/posts</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/posts')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get all posts with images and view counts</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/location</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/location')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get IP geolocation data</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/stats/popular/all</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/stats/popular/all')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get popular posts and articles by views</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/posts/{id}/like</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Like/unlike a post (toggle)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/articles/{id}/like</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Like/unlike an article (toggle)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/comments/{id}/like</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Like/unlike a comment (toggle)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/events/upcoming</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/events/upcoming')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get upcoming published events</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/events/search?q=zoom</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/events/search?q=zoom')">Try It</button>
                        </div>
                        <div class="endpoint-description">Search events by keyword</div>
                    </div>
                </div>
            </div>

            <div class="card admin-panel">
                <h2>🔐 Admin Panel</h2>
                <div class="test-section">
                    <div class="test-card">
                        <h3>Login</h3>
                        <div class="test-form">
                            <input type="text" class="test-input" id="username" placeholder="Username" value="admin">
                            <input type="password" class="test-input" id="password" placeholder="Password" value="admin123">
                            <button class="try-button" onclick="adminLogin()">Login</button>
                        </div>
                        <div id="login-result" class="test-result" style="display:none;"></div>
                    </div>

                    <div class="test-card">
                        <h3>Create Post</h3>
                        <div class="test-form">
                            <input type="text" class="test-input" id="post-title" placeholder="Post Title" value="Test Post">
                            <textarea class="test-input" id="post-content" placeholder="Post Content" rows="3">This is a test post created from the API documentation interface!</textarea>
                            <input type="text" class="test-input" id="post-author" placeholder="Author" value="API Tester">
                            <button class="try-button" onclick="createPost()">Create Post</button>
                        </div>
                        <div id="post-result" class="test-result" style="display:none;"></div>
                    </div>
                </div>
                
                <div class="test-card" style="margin-top: 20px;">
                    <h3>Admin Dashboard</h3>
                    <p>Get comprehensive statistics and analytics</p>
                    <button class="try-button" onclick="getDashboard()" style="margin-top: 10px;">Get Dashboard Stats</button>
                    <div id="dashboard-result" class="test-result" style="display:none;"></div>
                </div>
            </div>

            <div class="card">
                <h2>📝 Authentication Endpoints</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/auth/login</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Admin login - returns JWT token</div>
                        <div class="code-block">curl -X POST ${baseUrl}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"admin123"}'</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/auth/profile</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Get admin profile information</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method PUT">PUT</span>
                            <span class="path">${baseUrl}/auth/change-password</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Change admin password</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/auth/create-user</span>
                            <span class="auth-badge auth-superadmin">SUPERADMIN</span>
                        </div>
                        <div class="endpoint-description">Create new admin user (superadmin only)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/auth/users</span>
                            <span class="auth-badge auth-superadmin">SUPERADMIN</span>
                        </div>
                        <div class="endpoint-description">Get all users list (superadmin only)</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>📄 Posts Endpoints</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/posts</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/posts')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get all posts with view counts and image info</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/posts</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Create new post with multiple images (no auth required!)</div>
                        <div class="code-block">curl -X POST ${baseUrl}/posts \\
  -F "title=My Post" \\
  -F "content=Post content here" \\
  -F "author=Your Name" \\
  -F "images=@image1.jpg" \\
  -F "images=@image2.png"</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/posts/:id</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Get specific post by ID with view tracking</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method PUT">PUT</span>
                            <span class="path">${baseUrl}/posts/:id</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Update existing post</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method DELETE">DELETE</span>
                            <span class="path">${baseUrl}/posts/:id</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Delete post</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/posts/:id/stats</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Get detailed post statistics</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>💬 Comments Endpoints</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/posts/:post_id/comments</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Get all comments for a specific post</div>
                    </div>

                    <div class="endpoint>
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/posts/:post_id/comments</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Create comment with images (public access)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/comments</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Get all comments from all posts (admin only)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method PUT">PUT</span>
                            <span class="path">${baseUrl}/comments/:id</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Update comment (admin only)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method DELETE">DELETE</span>
                            <span class="path">${baseUrl}/comments/:id</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Delete comment (admin only)</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>📰 Articles Endpoints</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/articles</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/articles')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get published articles (public) or all articles (admin)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/articles/featured</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Get featured articles only</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/articles/search?q=term</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                        </div>
                        <div class="endpoint-description">Search articles by title/content</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method POST">POST</span>
                            <span class="path">${baseUrl}/articles</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Create new article with images (admin only)</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>📊 Statistics Endpoints</h2>
                <div class="endpoint-group">
                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/stats/popular/:type</span>
                            <span class="auth-badge auth-public">PUBLIC</span>
                            <button class="try-button" onclick="testEndpoint('${baseUrl}/stats/popular/all')">Try It</button>
                        </div>
                        <div class="endpoint-description">Get popular content by views (type: posts/articles/all)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/stats/dashboard</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Overall dashboard statistics</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/stats/content/:type</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Statistics by content type (post/comment/article)</div>
                    </div>

                    <div class="endpoint">
                        <div class="endpoint-header">
                            <span class="method GET">GET</span>
                            <span class="path">${baseUrl}/stats/images</span>
                            <span class="auth-badge auth-admin">ADMIN</span>
                        </div>
                        <div class="endpoint-description">Image usage statistics</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>🖼️ Upload Specifications & Features</h2>
                <ul style="list-style: none; padding: 0;">
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">📁 <strong>Supported Formats:</strong> JPEG, JPG, PNG, GIF, WebP</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">📏 <strong>Max File Size:</strong> 5MB per image</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">📄 <strong>Posts:</strong> Max 10 images per post</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">💬 <strong>Comments:</strong> Max 5 images per comment</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">📰 <strong>Articles:</strong> Max 10 images per article</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">� <strong>Events:</strong> Max 10 images per event (admin-only)</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">�📈 <strong>View Tracking:</strong> Automatic view counting for posts and articles</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">❤️ <strong>Like System:</strong> Like/unlike posts, articles, and comments</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">🔗 <strong>Zoom Integration:</strong> Direct meeting links, IDs, and passwords for events</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">👥 <strong>User Tracking:</strong> IP + User Agent based unique user identification</li>
                    <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">🏆 <strong>Popular Content:</strong> Rankings based on view counts and likes</li>
                    <li style="padding: 8px 0;">🔗 <strong>Access:</strong> ${baseUrl}/uploads/filename.ext</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>🚀 Pangan Jawara API v1.0.0 | Production Ready with Security & Analytics</p>
        <p>API Base: ${baseUrl}</p>
    </div>

    <script>
        let jwtToken = localStorage.getItem('jwt_token');
        
        async function testEndpoint(url) {
            try {
                const response = await fetch(url);
                const data = await response.json();
                alert('Response: ' + JSON.stringify(data, null, 2));
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        async function adminLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const resultDiv = document.getElementById('login-result');
            
            try {
                const response = await fetch('${baseUrl}/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.token) {
                    jwtToken = data.token;
                    localStorage.setItem('jwt_token', jwtToken);
                    resultDiv.textContent = 'Login successful! Token saved.\\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#c6f6d5';
                } else {
                    resultDiv.textContent = 'Login failed:\\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#fed7d7';
                }
                
                resultDiv.style.display = 'block';
            } catch (error) {
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.background = '#fed7d7';
                resultDiv.style.display = 'block';
            }
        }
        
        async function createPost() {
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            const author = document.getElementById('post-author').value;
            const resultDiv = document.getElementById('post-result');
            
            try {
                const formData = new FormData();
                formData.append('title', title);
                formData.append('content', content);
                formData.append('author', author);
                
                const response = await fetch('${baseUrl}/posts', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.textContent = 'Post created successfully!\\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#c6f6d5';
                } else {
                    resultDiv.textContent = 'Failed to create post:\\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#fed7d7';
                }
                
                resultDiv.style.display = 'block';
            } catch (error) {
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.background = '#fed7d7';
                resultDiv.style.display = 'block';
            }
        }
        
        async function getDashboard() {
            const resultDiv = document.getElementById('dashboard-result');
            
            if (!jwtToken) {
                resultDiv.textContent = 'Please login first to access admin dashboard.';
                resultDiv.style.background = '#fed7d7';
                resultDiv.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch('${baseUrl}/stats/dashboard', {
                    headers: {
                        'Authorization': 'Bearer ' + jwtToken
                    }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.textContent = JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#c6f6d5';
                } else {
                    resultDiv.textContent = 'Failed to get dashboard:\\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.background = '#fed7d7';
                }
                
                resultDiv.style.display = 'block';
            } catch (error) {
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.background = '#fed7d7';
                resultDiv.style.display = 'block';
            }
        }
        
        // Show saved token status on load
        if (jwtToken) {
            console.log('JWT Token loaded from localStorage');
        }
    </script>
</body>
</html>
    `);
  }
});

// Health check - environment aware
app.get(`${basePath}/health`, (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(), 
    timestamp: Date.now(),
    database: dbPool ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    deployment: envConfig.isSubdirectoryDeployment ? 'subdirectory' : 'root',
    config: envConfig.getConfigSummary()
  });
});

// Helper untuk ambil IP client
function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (xff.length) return xff[0];
  return req.connection?.remoteAddress?.replace('::ffff:', '') || req.ip;
}

function createGeoJSON(ip, location) {
  if (!location) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: {
        ip,
        country: null,
        region: null,
        city: null,
        timezone: null,
        provider: 'geoip-lite',
        meta: { queried_at: new Date().toISOString() }
      }
    };
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [location.ll[1], location.ll[0]] // [lon, lat]
    },
    properties: {
      ip,
      network: `${location.range[0]}-${location.range[1]}`,
      country: {
        code: location.country,
        name: location.country === 'ID' ? 'Indonesia' : null
      },
      region: location.region,
      city: location.city,
      location: {
        latitude: location.ll[0],
        longitude: location.ll[1],
        metro_code: location.metro,
        accuracy_radius_km: location.area || null
      },
      timezone: 'Asia/Jakarta',
      provider: 'geoip-lite',
      meta: {
        queried_at: new Date().toISOString(),
        confidence: 0.7
      }
    }
  };
}

// Location endpoint - environment aware
app.get(`${basePath}/location`, async (req, res) => {
  let ip = req.query.ip || getClientIp(req);
  const API_KEYS = [
    '49ed45276f7040f683bf65da1ffa2883',
    '0ccea66debe2461886d48d1f1fdba675',
    '8c184e8b521c4accaac762b835a7ee85',
    '1c08f7e0f7c244e49e22d7ef82951ad7',
    '9b2f1c14a0c64a45885b0c17d12ae7e9',
    '45f0c0eea19d4287b5ed2ff08dc6bb11',
    '652ac3f6cbf041a5adce47b9fd8afd36',
    'cf9a462ce9174b81a654fe94e9e9162e'
  ];
  if (ip === '::1' || ip === '127.0.0.1') ip = '160.22.134.39';

  // Pilih key yang masih di bawah limit 1000
  let selectedKey = null;
  try {
    selectedKey = await pickAvailableApiKey(dbPool, API_KEYS, 1000);
  } catch (err) {
    console.error('pickAvailableApiKey error:', err.message);
  }

  if (!selectedKey) {
    // Semua key habis kuota -> fallback offline
    const location = geoip.lookup(ip);
    return res.status(429).json({
      error: 'Daily quota exhausted for all API keys',
      fallback: createGeoJSON(ip, location)
    });
  }

  try {
    const resp = await axios.get(`https://api.ipgeolocation.io/v2/ipgeo?apiKey=${selectedKey}&ip=${ip}`);
    // increment usage jika berhasil
    try { await incrementApiKeyUsage(dbPool, selectedKey); } catch (incErr) { console.error('incrementApiKeyUsage error:', incErr.message); }
    const data = resp.data;
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(data.location.longitude), parseFloat(data.location.latitude)]
      },
      properties: {
        ip: data.ip,
        country: {
          code: data.location.country_code2,
          code3: data.location.country_code3,
          name: data.location.country_name,
          official_name: data.location.country_name_official,
          capital: data.location.country_capital,
          flag: data.location.country_flag,
          emoji: data.location.country_emoji,
          is_eu: data.location.is_eu
        },
        region: {
          state_prov: data.location.state_prov,
          state_code: data.location.state_code,
          district: data.location.district,
          city: data.location.city,
          zipcode: data.location.zipcode
        },
        location: {
          latitude: parseFloat(data.location.latitude),
          longitude: parseFloat(data.location.longitude),
          continent_code: data.location.continent_code,
          continent_name: data.location.continent_name,
          geoname_id: data.location.geoname_id
        },
        metadata: {
          calling_code: data.country_metadata.calling_code,
          tld: data.country_metadata.tld,
          languages: data.country_metadata.languages
        },
        currency: {
          code: data.currency.code,
          name: data.currency.name,
          symbol: data.currency.symbol
        },
        provider: 'ipgeolocation.io',
        meta: {
          queried_at: new Date().toISOString(),
          api_version: 'v2',
          api_key_used: selectedKey
        }
      }
    };
    res.json(geojson);
  } catch (e) {
    console.error('ipgeolocation.io API error:', e.message);
    const location = geoip.lookup(ip);
    const geojson = createGeoJSON(ip, location);
    geojson.properties.meta.api_key_used = selectedKey;
    res.json(geojson);
  }
});

// Route aliases: always serve at /pajar/ for backward compatibility
if (basePath === '') {
  // Documentation route alias
  app.get('/pajar', (req, res) => {
    const baseUrl = `https://${req.get('host')}/pajar`;
    
    // Check if client wants JSON or HTML
    const acceptHeader = req.get('Accept') || '';
    if (acceptHeader.includes('application/json') || req.query.format === 'json') {
      // Return JSON documentation with /pajar prefix
      res.json({
        name: "Pangan Jawara API with Multi-Image Support",
        version: "1.0.0",
        description: "Comprehensive REST API for managing posts, comments, and articles with admin authentication, image uploads, and analytics",
        baseUrl: baseUrl,
        note: "⚠️ This is a compatibility alias. Primary endpoint is at root (/)",
        primaryEndpoint: `https://${req.get('host')}/`,
        
        features: [
          "🌐 Public Content Creation - Anyone can create posts and comments with images",
          "🔐 Admin Authentication - JWT-based authentication for content management", 
          "📝 Post Management - Public creation, admin moderation with view & like tracking",
          "💬 Comment System - Public commenting with admin moderation and likes",
          "📰 Article System - CMS-like article management (admin-only) with view & like tracking",
          "🖼️ Multi-Image Upload - Support for multiple images per content",
          "❤️ Like System - Like/unlike functionality for posts, articles, and comments",
          "🔗 Zoom Integration - Direct Zoom meeting links and details for events",
          "📊 Analytics - Comprehensive statistics with geolocation, views, and likes tracking",
          "🌍 Geolocation Service - IP location tracking",
          "📈 Popular Content - View and like-based ranking for posts and articles",
          "🚀 Environment Aware - Automatic path configuration for different deployments"
        ],

        uploadSpecs: {
          supportedFormats: ["JPEG", "JPG", "PNG", "GIF", "WebP"],
          maxFileSize: "5MB per image",
          maxImagesPerPost: 10,
          maxImagesPerComment: 5,
          maxImagesPerArticle: 10,
          storageAccess: `${baseUrl.replace('/pajar', '')}/uploads/filename.ext`,
          environment: {
            deployment: 'subdirectory (compatibility mode)',
            staticRoute: '/uploads',
            apiBasePath: '/pajar'
          }
        },

        quickLinks: {
          "Health Check": `${baseUrl}/health`,
          "Posts": `${baseUrl}/posts`, 
          "Location": `${baseUrl}/location`,
          "Statistics": `${baseUrl}/stats/popular/all`
        }
      });
    } else {
      // Show HTML documentation for /pajar compatibility route
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-wi  dth, initial-scale=1.0">
    <title>Pangan Jawara API Documentation - Compatibility Mode</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            color: #2d3748;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .warning {
            background: #fed7d7;
            border: 1px solid #f56565;
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            color: #742a2a;
        }
        
        .card {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 20px;
        }
        
        .endpoint {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 0 8px 8px 0;
        }
        
        .method {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            font-size: 0.8rem;
            margin-right: 10px;
        }
        
        .method.GET { background: #48bb78; }
        .method.POST { background: #ed8936; }
        
        .path {
            font-family: 'Courier New', monospace;
            background: #edf2f7;
            padding: 8px 12px;
            border-radius: 6px;
            color: #2d3748;
            display: inline-block;
        }
        
        .try-button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.8rem;
            margin-left: 10px;
        }
        
        .try-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Pangan Jawara API Documentation</h1>
            <p>Compatibility Mode - /pajar prefix</p>
            <div class="warning">
                <strong>⚠️ Compatibility Mode:</strong> You are accessing the API through the /pajar compatibility prefix. 
                All endpoints are available with this prefix for backward compatibility.
            </div>
        </div>

        <div class="card">
            <h2>🔗 Quick Test Endpoints</h2>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <span class="path">${baseUrl}/health</span>
                <button class="try-button" onclick="testEndpoint('${baseUrl}/health')">Test Health</button>
                <p>Health check & server status</p>
            </div>
            
            <div class="endpoint">
                <span class="method GET">GET</span>
                <span class="path">${baseUrl}/posts</span>
                <button class="try-button" onclick="testEndpoint('${baseUrl}/posts')">Test Posts</button>
                <p>Get all posts with images and view counts</p>
            </div>

            <div class="endpoint">
                <span class="method GET">GET</span>
                <span class="path">${baseUrl}/wilayah/provinsi</span>
                <button class="try-button" onclick="testEndpoint('${baseUrl}/wilayah/provinsi')">Test Wilayah</button>
                <p>Get list of provinces in Indonesia</p>
            </div>

            <div class="endpoint">
                <span class="method GET">GET</span>
                <span class="path">${baseUrl}/location</span>
                <button class="try-button" onclick="testEndpoint('${baseUrl}/location')">Test Location</button>
                <p>Get IP geolocation data</p>
            </div>

            <div class="endpoint">
                <span class="method GET">GET</span>
                <span class="path">${baseUrl}/stats/popular/all</span>
                <button class="try-button" onclick="testEndpoint('${baseUrl}/stats/popular/all')">Test Stats</button>
                <p>Get popular posts and articles by views</p>
            </div>
        </div>

        <div class="card">
            <h2>📖 Documentation Access</h2>
            <p>For complete API documentation with all endpoints:</p>
            <ul style="margin-top: 10px;">
                <li><strong>JSON Format:</strong> <a href="${baseUrl}/?format=json" target="_blank">${baseUrl}/?format=json</a></li>
                <li><strong>Primary Documentation:</strong> <a href="https://${req.get('host')}/" target="_blank">https://${req.get('host')}/</a></li>
            </ul>
        </div>

        <div class="card">
            <h2>🎯 Available Endpoints</h2>
            <p>All standard endpoints are available with the <code>/pajar</code> prefix:</p>
            <ul style="margin-top: 10px; line-height: 1.8;">
                <li><code>/pajar/posts</code> - Post management</li>
                <li><code>/pajar/comments</code> - Comment system</li>
                <li><code>/pajar/articles</code> - Article CMS</li>
                <li><code>/pajar/auth</code> - Authentication</li>
                <li><code>/pajar/stats</code> - Analytics</li>
                <li><code>/pajar/events</code> - Event management</li>
                <li><code>/pajar/wilayah</code> - Indonesia regions data</li>
                <li><code>/pajar/uploads</code> - Static file access</li>
            </ul>
        </div>
    </div>

    <script>
        async function testEndpoint(url) {
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                // Create popup window to show results
                const popup = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
                popup.document.write(\`
                    <html>
                        <head><title>API Response - \${url}</title></head>
                        <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
                            <h2>Response from: \${url}</h2>
                            <hr>
                            <pre style="background: white; padding: 15px; border-radius: 5px; overflow-x: auto;">\${JSON.stringify(data, null, 2)}</pre>
                        </body>
                    </html>
                \`);
            } catch (error) {
                alert('Error: ' + error.message + '\\n\\nURL: ' + url);
            }
        }
    </script>
</body>
</html>
      `);
    }
  });

  // Health check alias
  app.get('/pajar/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(), 
      timestamp: Date.now(),
      database: dbPool ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      deployment: 'subdirectory (compatibility mode)',
      note: "⚠️ This is a compatibility alias. Primary endpoint is at /health",
      primaryEndpoint: `https://${req.get('host')}/health`,
      config: envConfig.getConfigSummary()
    });
  });

  // Location endpoint alias  
  app.get('/pajar/location', async (req, res) => {
    // Forward to primary location handler
    req.url = req.url.replace('/pajar', '');
    return app._router.handle(req, res);
  });
}

// Bootstrap async
(async () => {
  try {
    dbPool = await initDatabase();
    console.log('Database pool connected successfully');

  // Ensure necessary tables exists
  try { await createWilayahTable(dbPool); } catch (e) { console.error('createWilayahTable failed:', e.message); }
  try { await createApiKeyUsageTable(dbPool); } catch (e) { console.error('createApiKeyUsageTable failed:', e.message); }
  try { await createVideosTable(dbPool); } catch (e) { console.error('createVideosTable failed:', e.message); }
  try { await createEventsTable(dbPool); } catch (e) { console.error('createEventsTable failed:', e.message); }

    // Import dan inject routes sekarang - environment aware
    const createPostRoutes = require('./routes/posts');
    const createCommentRoutes = require('./routes/comments');
    const createAuthRoutes = require('./routes/auth');
    const createArticleRoutes = require('./routes/articles');
    const createVideoRoutes = require('./routes/videos');
    const createPublicArticleRoutes = require('./routes/publicArticles');
    const createPublicVideoRoutes = require('./routes/publicVideos');
    const createPublicPostRoutes = require('./routes/publicPosts');
    const createStatsRoutes = require('./routes/stats');
    const createEventRoutes = require('./routes/events');
    const createWilayahRoutes = require('./routes/wilayah');
    
    app.use(`${basePath}/posts`, createPostRoutes(dbPool));
    app.use(`${basePath}`, createCommentRoutes(dbPool));
    app.use(`${basePath}/auth`, createAuthRoutes(dbPool));
    app.use(`${basePath}/articles`, createArticleRoutes(dbPool));
    app.use(`${basePath}/videos`, createVideoRoutes(dbPool));
    app.use(`${basePath}/public/articles`, createPublicArticleRoutes(dbPool));
    app.use(`${basePath}/public/videos`, createPublicVideoRoutes(dbPool));
    app.use(`${basePath}/public/posts`, createPublicPostRoutes(dbPool));
    app.use(`${basePath}/stats`, createStatsRoutes(dbPool));
    app.use(`${basePath}/events`, createEventRoutes(dbPool));
    app.use(`${basePath}/wilayah`, createWilayahRoutes(dbPool));

    // Add route aliases for backward compatibility when basePath is empty
    if (basePath === '') {
      // Mount routes with /pajar prefix for compatibility
      app.use('/pajar/posts', createPostRoutes(dbPool));
      app.use('/pajar', createCommentRoutes(dbPool));
      app.use('/pajar/auth', createAuthRoutes(dbPool));
      app.use('/pajar/articles', createArticleRoutes(dbPool));
      app.use('/pajar/videos', createVideoRoutes(dbPool));
      app.use('/pajar/public/articles', createPublicArticleRoutes(dbPool));
      app.use('/pajar/public/videos', createPublicVideoRoutes(dbPool));
      app.use('/pajar/public/posts', createPublicPostRoutes(dbPool));
      app.use('/pajar/stats', createStatsRoutes(dbPool));
      app.use('/pajar/events', createEventRoutes(dbPool));
      app.use('/pajar/wilayah', createWilayahRoutes(dbPool));
      
      console.log('✅ Backward compatibility routes mounted at /pajar/* for subdirectory deployment');
    }

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT. Graceful shutdown...');
      await closePool();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM. Graceful shutdown...');
      await closePool();
      process.exit(0);
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}/pajar`);
      console.log('✅ MySQL connection pool initialized with auto-reconnect');
    });
  } catch (err) {
    console.error('Fatal error during app startup:', err);
    process.exit(1);
  }
})();