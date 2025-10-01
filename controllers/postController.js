const Post = require('../models/Post');
const Statistics = require('../models/Statistics');
const { saveImageRecords } = require('../utils/upload');
const geoip = require('geoip-lite');

class PostController {
  constructor(db) {
    this.postModel = new Post(db);
    this.statisticsModel = new Statistics(db);
  }

  // Helper untuk mendapatkan IP dan lokasi
  getClientInfo(req) {
    const xff = (req.headers['x-forwarded-for'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    let ip = xff.length ? xff[0] : req.connection?.remoteAddress?.replace('::ffff:', '') || req.ip;
    if (ip === '::1' || ip === '127.0.0.1') ip = '114.124.188.1'; // fallback for localhost
    
    const location = geoip.lookup(ip);
    return {
      ip,
      country: location?.country || null,
      city: location?.city || null,
      userAgent: req.headers['user-agent']
    };
  }

  // Membuat post baru (public - anyone can post)
  async createPost(req, res) {
    try {
      const { title, content, author } = req.body;
      
      // Validasi input
      if (!title || !content || !author) {
        return res.status(400).json({ 
          error: 'Title, content, and author are required' 
        });
      }
      
      const postId = await this.postModel.create({ title, content, author });

      // Handle image uploads if present
      let images = [];
      if (req.files && req.files.length > 0) {
        images = await saveImageRecords(req.db, 'post', postId, req.files);
      }

      res.status(201).json({ 
        message: 'Post created successfully', 
        postId,
        imagesUploaded: images.length,
        images: images.map(img => ({
          id: img.id,
          filename: img.filename,
          originalName: img.original_name,
          path: img.path // Path sudah include /pajar/uploads/ dari saveImageRecords
        }))
      });
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Mendapatkan semua post
  async getAllPosts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // Get posts and total count
      const [posts, totalCount] = await Promise.all([
        this.postModel.getAll(limit, offset),
        this.postModel.getTotalCount()
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        posts,
        pagination: {
          currentPage: page,
          limit,
          totalItems: totalCount,
          totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        }
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Mendapatkan post berdasarkan ID (public, with view tracking)
  async getPostById(req, res) {
    try {
      const { id } = req.params;
      const post = await this.postModel.getById(id);
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Record view statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.record(
        'post', 
        id, 
        'view', 
        clientInfo.ip, 
        clientInfo.userAgent, 
        clientInfo.country, 
        clientInfo.city
      );
      await this.postModel.incrementViewCount(id);
      
      res.json(post);
    } catch (error) {
      console.error('Error fetching post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Memperbarui post (admin only)
  async updatePost(req, res) {
    try {
      const { id } = req.params;
      const { title, content } = req.body;
      
      // Validasi input
      if (!title || !content) {
        return res.status(400).json({ 
          error: 'Title and content are required' 
        });
      }
      
      const updated = await this.postModel.update(id, { title, content });
      
      if (!updated) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Handle new image uploads if present
      let newImages = [];
      if (req.files && req.files.length > 0) {
        newImages = await saveImageRecords(req.db, 'post', id, req.files);
      }
      
      res.json({ 
        message: 'Post updated successfully',
        newImages: newImages.length 
      });
    } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Menghapus post (admin only)
  async deletePost(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.postModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get post statistics (admin only)
  async getPostStats(req, res) {
    try {
      const { id } = req.params;
      
      const views = await this.statisticsModel.getCount('post', id, 'view');
      const allStats = await this.statisticsModel.getByEntity('post', id);
      
      // Group by action
      const statsSummary = allStats.reduce((acc, stat) => {
        if (!acc[stat.action]) acc[stat.action] = 0;
        acc[stat.action]++;
        return acc;
      }, {});

      res.json({
        postId: id,
        totalViews: views,
        summary: statsSummary,
        recentActivity: allStats.slice(0, 50) // Last 50 activities
      });
    } catch (error) {
      console.error('Error fetching post statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Like/Unlike post (public)
  async likePost(req, res) {
    try {
      const { id } = req.params;
      
      // Check if post exists
      const post = await this.postModel.getById(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Get client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle like
      const result = await this.postModel.toggleLike(id, clientInfo.ip, clientInfo.userAgent);
      
      // Get updated post data
      const updatedPost = await this.postModel.getById(id);
      
      res.json({
        success: true,
        message: `Post ${result.action} successfully`,
        liked: result.liked,
        like_count: updatedPost.like_count
      });
    } catch (error) {
      console.error('Error toggling post like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has liked post (public)
  async checkPostLike(req, res) {
    try {
      const { id } = req.params;
      
      // Get client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has liked this post
      const hasLiked = await this.postModel.hasUserLiked(id, clientInfo.ip, clientInfo.userAgent);
      
      res.json({
        liked: hasLiked
      });
    } catch (error) {
      console.error('Error checking post like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Share/Unshare post (public)
  async sharePost(req, res) {
    try {
      const { id } = req.params;
      
      // Check if post exists
      const post = await this.postModel.getById(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Get client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle share
      const result = await this.postModel.toggleShare(id, clientInfo.ip, clientInfo.userAgent);
      
      // Get updated post data
      const updatedPost = await this.postModel.getById(id);
      
      res.json({
        success: true,
        message: `Post ${result.action} successfully`,
        shared: result.shared,
        shared_count: updatedPost.shared_count
      });
    } catch (error) {
      console.error('Error toggling post share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has shared post (public)
  async checkPostShare(req, res) {
    try {
      const { id } = req.params;
      
      // Get client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has shared this post
      const hasShared = await this.postModel.hasUserShared(id, clientInfo.ip, clientInfo.userAgent);
      
      res.json({
        shared: hasShared
      });
    } catch (error) {
      console.error('Error checking post share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Increment share count (public - for external shares)
  async incrementPostShare(req, res) {
    try {
      const { id } = req.params;
      
      // Check if post exists
      const post = await this.postModel.getById(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Increment share count
      await this.postModel.incrementShareCount(id);
      
      // Get updated post data
      const updatedPost = await this.postModel.getById(id);
      
      res.json({
        success: true,
        message: 'Share count incremented',
        shared_count: updatedPost.shared_count
      });
    } catch (error) {
      console.error('Error incrementing post share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search posts (public)
  async searchPosts(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Get search results and total count
      const [posts, totalCount] = await Promise.all([
        this.postModel.search(q, limit, offset),
        this.postModel.getSearchTotalCount(q)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        posts,
        query: q,
        pagination: {
          currentPage: page,
          limit,
          totalItems: totalCount,
          totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        }
      });
    } catch (error) {
      console.error('Error searching posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get trending posts (public)
  async getTrendingPosts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // Get trending posts and total count
      const [posts, totalCount] = await Promise.all([
        this.postModel.getTrending(limit, offset),
        this.postModel.getTotalCount() // For trending we use total count since all posts are eligible
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        posts,
        message: 'Trending posts based on popularity metrics',
        pagination: {
          currentPage: page,
          limit,
          totalItems: totalCount,
          totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        }
      });
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = PostController;