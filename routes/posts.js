const express = require('express');
const PostController = require('../controllers/postController');
const { authenticateToken, requireAdmin } = require('../utils/auth');
const { upload } = require('../utils/upload');

// Mengekspor fungsi factory yang menerima instance dbPool
module.exports = function createPostRoutes(dbPool) {
  const router = express.Router();
  const postController = new PostController(dbPool);

  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public routes
  router.get('/', postController.getAllPosts.bind(postController));
  router.get('/search', postController.searchPosts.bind(postController));
  router.get('/trending', postController.getTrendingPosts.bind(postController));
  router.get('/:id', postController.getPostById.bind(postController));
  
  // Like functionality (public)
  router.post('/:id/like', postController.likePost.bind(postController));
  router.get('/:id/like-status', postController.checkPostLike.bind(postController));
  
  // Share functionality (public)
  router.post('/:id/share', postController.sharePost.bind(postController));
  router.get('/:id/share-status', postController.checkPostShare.bind(postController));
  router.post('/:id/share-count', postController.incrementPostShare.bind(postController));
  
  // Public posting (anyone can create posts with images)
  router.post('/', upload.array('images', 10), postController.createPost.bind(postController));

  // Protected admin routes (for management only)
  router.put('/:id', authenticateToken, requireAdmin, upload.array('images', 10), postController.updatePost.bind(postController));
  router.delete('/:id', authenticateToken, requireAdmin, postController.deletePost.bind(postController));
  router.get('/:id/stats', authenticateToken, requireAdmin, postController.getPostStats.bind(postController));

  return router;
};
