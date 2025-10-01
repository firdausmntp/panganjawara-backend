const express = require('express');
const EventController = require('../controllers/eventController');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../utils/auth');
const { upload } = require('../utils/upload');

module.exports = function createEventRoutes(dbPool) {
  const router = express.Router();
  const eventController = new EventController(dbPool);
  
  // Middleware to inject dbPool into req for file handling
  router.use((req, res, next) => {
    req.db = dbPool;
    next();
  });

  // Public routes
  router.get('/upcoming', eventController.getUpcomingEvents.bind(eventController));
  router.get('/search', eventController.searchEvents.bind(eventController));
  
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
  }, eventController.getEventById.bind(eventController));

  // Admin routes (requires admin or superadmin)
  router.get('/', authenticateToken, requireAdmin, eventController.getAllEvents.bind(eventController));
  router.post('/', authenticateToken, requireAdmin, upload.array('images', 10), eventController.createEvent.bind(eventController));
  router.put('/:id', authenticateToken, requireAdmin, upload.array('images', 10), eventController.updateEvent.bind(eventController));
  router.delete('/:id', authenticateToken, requireAdmin, eventController.deleteEvent.bind(eventController));
  router.get('/admin/date-range', authenticateToken, requireAdmin, eventController.getEventsByDateRange.bind(eventController));
  router.get('/admin/stats', authenticateToken, requireAdmin, eventController.getEventStats.bind(eventController));

  return router;
};
