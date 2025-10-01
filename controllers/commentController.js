const Comment = require('../models/Comment');
const Statistics = require('../models/Statistics');
const { saveImageRecords } = require('../utils/upload');

class CommentController {
  constructor(db) {
    this.commentModel = new Comment(db);
    this.statisticsModel = new Statistics(db);
  }

  // Membuat komentar baru (public - no auth required)
  async createComment(req, res) {
    try {
      const { post_id } = req.params;
      const { author, content } = req.body;
      
      // Validasi input
      if (!author || !content) {
        return res.status(400).json({ 
          error: 'Author and content are required' 
        });
      }
      
      const commentId = await this.commentModel.create({ post_id, author, content });

      // Handle image uploads if present
      let images = [];
      if (req.files && req.files.length > 0) {
        images = await saveImageRecords(req.db, 'comment', commentId, req.files);
      }

      res.status(201).json({ 
        message: 'Comment created successfully', 
        commentId,
        images: images.length
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Mendapatkan semua komentar untuk sebuah post
  async getCommentsByPostId(req, res) {
    try {
      const { post_id } = req.params;
      const comments = await this.commentModel.getByPostId(post_id);
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Mendapatkan semua komentar (admin only)
  async getAllComments(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const comments = await this.commentModel.getAll(limit, offset);
      
      res.json({
        comments,
        pagination: {
          limit,
          offset,
          total: comments.length
        }
      });
    } catch (error) {
      console.error('Error fetching all comments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Memperbarui komentar (admin only)
  async updateComment(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      // Validasi input
      if (!content) {
        return res.status(400).json({ 
          error: 'Content is required' 
        });
      }
      
      const updated = await this.commentModel.update(id, content);
      
      if (!updated) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Handle new image uploads if present
      let newImages = [];
      if (req.files && req.files.length > 0) {
        newImages = await saveImageRecords(req.db, 'comment', id, req.files);
      }
      
      res.json({ 
        message: 'Comment updated successfully',
        newImages: newImages.length 
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Menghapus komentar (admin only)
  async deleteComment(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.commentModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Like/Unlike comment (public)
  async likeComment(req, res) {
    try {
      const { id } = req.params;
      
      // Check if comment exists
      const comment = await this.commentModel.getById(id);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Get client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle like
      const result = await this.commentModel.toggleLike(id, clientInfo.ip, clientInfo.userAgent);
      
      // Get updated comment data (need to create getById method in Comment model)
      const updatedComment = await this.commentModel.getById(id);
      
      res.json({
        success: true,
        message: `Comment ${result.action} successfully`,
        liked: result.liked,
        like_count: updatedComment.like_count
      });
    } catch (error) {
      console.error('Error toggling comment like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has liked comment (public)
  async checkCommentLike(req, res) {
    try {
      const { id } = req.params;
      
      // Get client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has liked this comment
      const hasLiked = await this.commentModel.hasUserLiked(id, clientInfo.ip, clientInfo.userAgent);
      
      res.json({
        liked: hasLiked
      });
    } catch (error) {
      console.error('Error checking comment like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Helper method to get client information
  getClientInfo(req) {
    return {
      ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };
  }
}

module.exports = CommentController;