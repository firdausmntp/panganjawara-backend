const express = require('express');
const ArticleController = require('../controllers/articleController');

module.exports = function createPublicArticleRoutes(dbPool) {
  const router = express.Router();
  const articleController = new ArticleController(dbPool);
  
  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public-only routes - no authentication required, only published articles
  router.get('/', articleController.getAllArticles.bind(articleController));
  router.get('/paginated', articleController.getAllArticles.bind(articleController)); // Explicit pagination endpoint
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
  
  // Public route for individual articles (no draft access even for admins)
  router.get('/:id', (req, res, next) => {
    // Force public access - don't pass any user info
    req.user = null;
    next();
  }, articleController.getArticleById.bind(articleController));

  return router;
};
