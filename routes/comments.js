const express = require('express');
const CommentController = require('../controllers/commentController');
const { authenticateToken, requireAdmin } = require('../utils/auth');
const { upload } = require('../utils/upload');

module.exports = function createCommentRoutes(dbPool) {
  const router = express.Router();
  const commentController = new CommentController(dbPool);

  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public routes (anyone can create and view comments)
  router.post('/posts/:post_id/comments', upload.array('images', 5), commentController.createComment.bind(commentController));
  router.get('/posts/:post_id/comments', commentController.getCommentsByPostId.bind(commentController));
  
  // Like functionality for comments (public)
  router.post('/comments/:id/like', commentController.likeComment.bind(commentController));
  router.get('/comments/:id/like-status', commentController.checkCommentLike.bind(commentController));

  // Admin routes
  router.get('/comments', authenticateToken, requireAdmin, commentController.getAllComments.bind(commentController));
  router.put('/comments/:id', authenticateToken, requireAdmin, upload.array('images', 5), commentController.updateComment.bind(commentController));
  router.delete('/comments/:id', authenticateToken, requireAdmin, commentController.deleteComment.bind(commentController));

  return router;
};
