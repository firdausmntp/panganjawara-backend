const express = require('express');
const PostController = require('../controllers/postController');

module.exports = function createPublicPostRoutes(dbPool) {
  const router = express.Router();
  const postController = new PostController(dbPool);
  
  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public-only routes - no authentication required
  router.get('/', postController.getAllPosts.bind(postController));
  router.get('/paginated', postController.getAllPosts.bind(postController)); // Explicit pagination endpoint
  router.get('/search', postController.searchPosts.bind(postController));
  router.get('/trending', postController.getTrendingPosts.bind(postController));
  
  // Like functionality (public)
  router.post('/:id/like', postController.likePost.bind(postController));
  router.get('/:id/like-status', postController.checkPostLike.bind(postController));
  
  // Share functionality (public)
  router.post('/:id/share', postController.sharePost.bind(postController));
  router.get('/:id/share-status', postController.checkPostShare.bind(postController));
  router.post('/:id/share-count', postController.incrementPostShare.bind(postController));
  
  // Public route for individual posts
  router.get('/:id', postController.getPostById.bind(postController));

  return router;
};
