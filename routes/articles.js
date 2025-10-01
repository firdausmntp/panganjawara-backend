const express = require('express');
const ArticleController = require('../controllers/articleController');
const { authenticateToken, requireAdmin } = require('../utils/auth');
const { upload } = require('../utils/upload');

module.exports = function createArticleRoutes(dbPool) {
  const router = express.Router();
  const articleController = new ArticleController(dbPool);
  
  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public routes
  router.get('/', articleController.getAllArticles.bind(articleController));
  router.get('/all', authenticateToken, requireAdmin, articleController.getAllArticlesAllStatuses.bind(articleController));
  router.get('/featured', articleController.getFeaturedArticles.bind(articleController));
  router.get('/trending', articleController.getTrendingArticles.bind(articleController));
  router.get('/search', articleController.searchArticles.bind(articleController));
  
  // Like functionality (public)
  router.post('/:id/like', articleController.likeArticle.bind(articleController));
  router.get('/:id/like-status', articleController.checkArticleLike.bind(articleController));
  
  // Share functionality (public)
  router.post('/:id/share', articleController.shareArticle.bind(articleController));
  router.get('/:id/share-status', articleController.checkArticleShare.bind(articleController));
  router.post('/:id/share-count', articleController.incrementArticleShare.bind(articleController));
  
  // Public route but with optional auth for admin to see drafts
  router.get('/:id', (req, res, next) => {
    // Try to authenticate but don't require it
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
      } catch (error) {
        // Invalid token, continue without user
      }
    }
    next();
  }, articleController.getArticleById.bind(articleController));

  // Protected admin routes
  router.post('/', authenticateToken, requireAdmin, upload.array('images', 10), articleController.createArticle.bind(articleController));
  router.put('/:id', authenticateToken, requireAdmin, upload.array('images', 10), articleController.updateArticle.bind(articleController));
  router.delete('/:id', authenticateToken, requireAdmin, articleController.deleteArticle.bind(articleController));
  router.get('/:id/stats', authenticateToken, requireAdmin, articleController.getArticleStats.bind(articleController));

  return router;
};
