const express = require('express');
const VideoController = require('../controllers/videoController');

module.exports = function createPublicVideoRoutes(dbPool) {
  const router = express.Router();
  const videoController = new VideoController(dbPool);

  // Public-only routes - no authentication required, only published videos

  // GET /public/videos - Get all published videos
  router.get('/', videoController.getPublicVideos.bind(videoController));

  // GET /public/videos/featured - Get featured published videos
  router.get('/featured', videoController.getPublicFeaturedVideos.bind(videoController));

  // GET /public/videos/trending - Get trending published videos
  router.get('/trending', videoController.getPublicTrendingVideos.bind(videoController));

  // GET /public/videos/search - Search published videos
  router.get('/search', videoController.searchPublicVideos.bind(videoController));

  // GET /public/videos/:id - Get published video by ID
  router.get('/:id', videoController.getPublicVideoById.bind(videoController));

  // POST /public/videos/:id/like - Like video (public)
  router.post('/:id/like', videoController.likePublicVideo.bind(videoController));

  return router;
};
