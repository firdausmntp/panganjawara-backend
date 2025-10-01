const express = require('express');
const VideoController = require('../controllers/videoController');
const { authenticateToken, requireAdmin } = require('../utils/auth');

module.exports = function createVideoRoutes(dbPool) {
  const router = express.Router();
  const videoController = new VideoController(dbPool);

  // All video routes require admin authentication
  router.use(authenticateToken);
  router.use(requireAdmin);

  // GET /videos - Get all videos with pagination and filtering
  router.get('/', videoController.getAllVideos.bind(videoController));

  // GET /videos/featured - Get featured videos
  router.get('/featured', videoController.getFeaturedVideos.bind(videoController));

  // GET /videos/trending - Get trending videos
  router.get('/trending', videoController.getTrendingVideos.bind(videoController));

  // GET /videos/search - Search videos
  router.get('/search', videoController.searchVideos.bind(videoController));

  // POST /videos - Create new video
  router.post('/', videoController.createVideo.bind(videoController));

  // GET /videos/:id - Get video by ID
  router.get('/:id', videoController.getVideoById.bind(videoController));

  // PUT /videos/:id - Update video
  router.put('/:id', videoController.updateVideo.bind(videoController));

  // DELETE /videos/:id - Delete video
  router.delete('/:id', videoController.deleteVideo.bind(videoController));

  // GET /videos/:id/stats - Get video statistics
  router.get('/:id/stats', videoController.getVideoStats.bind(videoController));

  // POST /videos/:id/like - Like video
  router.post('/:id/like', videoController.likeVideo.bind(videoController));

  return router;
};
