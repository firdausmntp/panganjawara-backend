const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../utils/auth');

module.exports = function createAuthRoutes(dbPool) {
  const router = express.Router();
  const authController = new AuthController(dbPool);

  // Public routes (no authentication required)
  router.post('/login', authController.login.bind(authController));

  // Protected routes (require authentication)
  router.get('/profile', authenticateToken, authController.getProfile.bind(authController));
  router.put('/change-password', authenticateToken, authController.changePassword.bind(authController));

  // Superadmin only routes (require superadmin role)
  router.post('/create-user', authenticateToken, requireSuperAdmin, authController.createUser.bind(authController));
  router.get('/users', authenticateToken, requireSuperAdmin, authController.getAllUsers.bind(authController));
  router.put('/users/:id', authenticateToken, requireSuperAdmin, authController.updateUser.bind(authController));

  return router;
};
