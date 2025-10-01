const express = require('express');
const StatsController = require('../controllers/statsController');
const { authenticateToken, requireAdmin } = require('../utils/auth');

module.exports = function createStatsRoutes(dbPool) {
  const router = express.Router();
  const statsController = new StatsController(dbPool);

  // Public endpoint for popular content (no auth required)
  router.get('/popular/:type', statsController.getPopularContent.bind(statsController));

  // All other stats routes require admin authentication
  router.use(authenticateToken);
  router.use(requireAdmin);

  // Dashboard overview
  router.get('/dashboard', statsController.getDashboardStats.bind(statsController));

  // Content-specific statistics
  router.get('/content/:type', statsController.getContentStats.bind(statsController));
  router.get('/content/:type/:id', statsController.getDetailedStats.bind(statsController));

  // Image statistics
  router.get('/images', statsController.getImageStats.bind(statsController));

  // Maintenance
  router.delete('/cleanup', statsController.cleanOldStats.bind(statsController));

  return router;
};
