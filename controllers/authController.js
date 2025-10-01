const User = require('../models/User');
const { generateToken, hashPassword, comparePassword } = require('../utils/auth');

class AuthController {
  constructor(db) {
    this.userModel = new User(db);
  }

  // Admin login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Get user by username
      const user = await this.userModel.getByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await this.userModel.updateLastLogin(user.id);

      // Generate token
      const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          last_login: user.last_login
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create new admin user (admin only)
  async createUser(req, res) {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ 
          error: 'Username, email, and password are required' 
        });
      }

      // Check if user already exists
      const existingUser = await this.userModel.getByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const existingEmail = await this.userModel.getByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const userId = await this.userModel.create({
        username,
        email,
        password: hashedPassword,
        role: 'admin'
      });

      res.status(201).json({
        message: 'Admin user created successfully',
        userId
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await this.userModel.getById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          error: 'Current password and new password are required' 
        });
      }

      // Get user
      const user = await this.userModel.getByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check current password
      const isValidPassword = await comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await this.userModel.updatePassword(user.id, hashedNewPassword);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get all users (superadmin only)
  async getAllUsers(req, res) {
    try {
      const users = await this.userModel.getAllUsers();
      
      // Remove password from response
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }));

      res.json({
        message: 'Users retrieved successfully',
        users: sanitizedUsers,
        total: sanitizedUsers.length
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update user (superadmin only)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, email, role } = req.body;

      // Get current user
      const currentUser = await this.userModel.getById(id);
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Validate role
      if (role && !['user', 'admin', 'superadmin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Check if username is already taken by another user
      if (username && username !== currentUser.username) {
        const existingUser = await this.userModel.getByUsername(username);
        if (existingUser) {
          return res.status(400).json({ error: 'Username already exists' });
        }
      }

      // Check if email is already taken by another user
      if (email && email !== currentUser.email) {
        const existingUser = await this.userModel.getByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      // Update user
      const updated = await this.userModel.update(id, {
        username: username || currentUser.username,
        email: email || currentUser.email,
        role: role || currentUser.role
      });

      if (!updated) {
        return res.status(500).json({ error: 'Failed to update user' });
      }

      // Get updated user
      const updatedUser = await this.userModel.getById(id);
      const { password, ...sanitizedUser } = updatedUser;

      res.json({
        message: 'User updated successfully',
        user: sanitizedUser
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
