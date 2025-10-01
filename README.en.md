# Posting API with Admin Authentication & Multi-Image Support

A comprehensive REST API for managing posts, comments, and articles with admin authentication, image uploads, and analytics.

## Features

- **Public Content Creation**: Anyone can create posts and comments with images
- **Admin Authentication**: JWT-based authentication for content management
- **Post Management**: Public creation, admin moderation
- **Comment System**: Public commenting with admin moderation
- **Article System**: CMS-like article management with multiple images (admin-only)
- **Image Upload**: Multi-image support for posts, comments, and articles
- **Analytics**: Comprehensive statistics tracking with geolocation
- **Health Check**: System status and geolocation endpoints

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your settings
4. Start XAMPP (MySQL service)
5. **Import database**: Import `database_setup.sql` into your MySQL/MariaDB
6. Run the application: `npm start`

📋 See `DATABASE_SETUP.md` for detailed database setup instructions.

## Default Admin User

- **Username**: `your-admin-username`
- **Password**: `your-secure-password`
- **Email**: `admin@your-domain.test`

⚠️ **Important**: Replace these placeholders in your seed data and use strong credentials in production.

## API Endpoints

### Authentication (`/pajar/auth`)

- `POST /login` - Admin login
- `GET /profile` - Get admin profile (auth required)
- `PUT /change-password` - Change password (auth required)
- `POST /create-user` - Create new admin user (admin only)

### Posts (`/pajar/posts`)

- `GET /` - Get all posts (public)
- `GET /:id` - Get post by ID with view tracking (public)
- `POST /` - Create post with images (public - no auth required!)
- `PUT /:id` - Update post with new images (admin only)
- `DELETE /:id` - Delete post (admin only)
- `GET /:id/stats` - Get post statistics (admin only)

### Comments (`/pajar`)

- `GET /posts/:post_id/comments` - Get comments for a post (public)
- `POST /posts/:post_id/comments` - Create comment with images (public)
- `PUT /comments/:id` - Update comment (admin only)
- `DELETE /comments/:id` - Delete comment (admin only)

### Articles (`/pajar/articles`)

- `GET /` - Get all published articles (public, admin sees all)
- `GET /featured` - Get featured articles (public)
- `GET /search?q=term` - Search articles (public)
- `GET /:id` - Get article by ID with view tracking (public for published)
- `POST /` - Create article with images (admin only)
- `PUT /:id` - Update article with new images (admin only)
- `DELETE /:id` - Delete article (admin only)
- `GET /:id/stats` - Get article statistics (admin only)

### Statistics (`/pajar/stats`)

All endpoints require admin authentication:

- `GET /dashboard` - Overall dashboard statistics
- `GET /content/:type` - Statistics by content type (post/comment/article)
- `GET /content/:type/:id` - Detailed statistics for specific content
- `GET /images` - Image usage statistics
- `DELETE /cleanup?days=365` - Clean old statistics

### System

- `GET /` - API information
- `GET /health` - Health check
- `GET /location?ip=x.x.x.x` - Get geolocation data

## File Upload

### Supported Formats
- JPEG, JPG, PNG, GIF, WebP
- Maximum file size: 5MB
- Maximum files per request: 10 (posts/articles), 5 (comments)

### Upload Examples

```bash
# Create post with images
curl -X POST http://localhost:3000/pajar/posts \
  -F "title=My Post" \
  -F "content=Post content here" \
  -F "author=Public User" \
  -F "images=@image1.jpg" \
  -F "images=@image2.png"

# Create comment with images
curl -X POST http://localhost:3000/pajar/posts/1/comments \
  -F "author=Anonymous User" \
  -F "content=Nice post!" \
  -F "images=@reaction.gif"
```

## Authentication

### Login
```bash
curl -X POST http://localhost:3000/pajar/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Using JWT Token
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/pajar/posts
```

## Database Schema

The SQL file creates these tables:

- **users**: Admin user accounts
- **posts**: Blog posts with view counts and image counts
- **comments**: Comments linked to posts with image support
- **articles**: CMS articles with rich content and multiple states
- **images**: File metadata for all uploaded images
- **statistics**: Analytics data with geolocation tracking

## MariaDB Compatibility ✅

Fully compatible with:
- ✅ MySQL 5.7+
- ✅ MySQL 8.0+
- ✅ MariaDB 10.3+
- ✅ MariaDB 10.6+ (your hosting server)

## Environment Variables

See `.env.example` for all available configuration options.

## Development

- `npm start` - Production mode
- `npm run dev` - Development mode with nodemon

## Working with Git

- The provided `.gitignore` keeps secrets, dependencies, and generated uploads out of version control. Move any assets you do want to track out of the ignored paths before committing.
- Commit the generated database migrations or seed files if they are required for others to reproduce your environment; avoid committing exports of live data.
- Tag releases when you deploy so API consumers can lock to a known version.

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- File upload validation
- SQL injection protection
- Admin-only routes protection

## Analytics Features

- View tracking with geolocation
- User agent tracking
- Content performance metrics
- Geographic distribution analysis
- Hourly activity patterns
- Image usage statistics

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden (Admin required)
- 404: Not Found
- 500: Internal Server Error

## License

Distributed under the MIT License. See the `LICENSE` file for more information.
