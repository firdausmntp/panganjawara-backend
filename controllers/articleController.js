const Article = require('../models/Article');
const Statistics = require('../models/Statistics');
const { saveImageRecords, getImagesByEntity } = require('../utils/upload');
const geoip = require('geoip-lite');

class ArticleController {
  constructor(db) {
    this.articleModel = new Article(db);
    this.statisticsModel = new Statistics(db);
  }

  // Helper untuk mendapatkan IP dan lokasi dengan fingerprinting yang lebih akurat
  getClientInfo(req) {
    const xff = (req.headers['x-forwarded-for'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    let ip = xff.length ? xff[0] : req.connection?.remoteAddress?.replace('::ffff:', '') || req.ip;
    if (ip === '::1' || ip === '127.0.0.1') ip = '114.124.188.1'; // fallback for localhost
    
    const location = geoip.lookup(ip);
    
    // Generate more unique fingerprint
    const userAgent = req.headers['user-agent'] || 'unknown';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const accept = req.headers['accept'] || '';
    const xForwardedFor = req.headers['x-forwarded-for'] || '';
    const referer = req.headers['referer'] || '';
    
    // Create unique fingerprint combining multiple factors
    const crypto = require('crypto');
    const fingerprintData = `${ip}|${userAgent}|${acceptLanguage}|${acceptEncoding}|${accept}|${xForwardedFor}|${referer}`;
    const fingerprint = crypto.createHash('md5').update(fingerprintData).digest('hex');
    
    return {
      ip,
      country: location?.country || null,
      city: location?.city || null,
      userAgent,
      fingerprint,
      acceptLanguage,
      acceptEncoding
    };
  }

  // Membuat article baru (admin only)
  async createArticle(req, res) {
    try {
      const { title, content, excerpt, status = 'draft', tags, featured = false } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          error: 'Title and content are required' 
        });
      }

      // Create article
      const articleId = await this.articleModel.create({
        title,
        content,
        excerpt: excerpt || content.substring(0, 200) + '...',
        author: req.user.username,
        status,
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : tags) : null,
        featured
      });

      // Handle image uploads if present
      let images = [];
      if (req.files && req.files.length > 0) {
        images = await saveImageRecords(req.db, 'article', articleId, req.files);
      }

      res.status(201).json({
        message: 'Article created successfully',
        articleId,
        images: images.length
      });
    } catch (error) {
      console.error('Error creating article:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get all articles (public, published only / admin can see all)
  async getAllArticles(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // Admin can see all, public only sees published
      const status = req.user?.role === 'admin' ? null : 'published';
      
      // Get articles and total count
      const [articles, totalCount] = await Promise.all([
        this.articleModel.getAll(limit, offset, status),
        this.articleModel.getTotalCount(status)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        articles,
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
      console.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get all articles with all statuses (admin only)
  async getAllArticlesAllStatuses(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // No status filter - get all articles regardless of status
      const [articles, totalCount] = await Promise.all([
        this.articleModel.getAll(limit, offset, null),
        this.articleModel.getTotalCount(null)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        articles,
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
      console.error('Error fetching all articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get article by ID (public for published, admin for all)
  async getArticleById(req, res) {
    try {
      const { id } = req.params;
      const article = await this.articleModel.getById(id);
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Debug logging

      // Check if user can access this article
      if (article.status !== 'published' && (!req.user || req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        console.log('Access denied: Article is not published and user is not admin');
        return res.status(403).json({ error: 'Article not available' });
      }

      // Record view statistics for published articles
      if (article.status === 'published') {
        const clientInfo = this.getClientInfo(req);
        await this.statisticsModel.record(
          'article', 
          id, 
          'view', 
          clientInfo.ip, 
          clientInfo.userAgent, 
          clientInfo.country, 
          clientInfo.city
        );
        await this.articleModel.incrementViewCount(id);
      }

      res.json(article);
    } catch (error) {
      console.error('Error fetching article:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update article (admin only)
  async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const { title, content, excerpt, status, tags, featured } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          error: 'Title and content are required' 
        });
      }

      const updated = await this.articleModel.update(id, {
        title,
        content,
        excerpt: excerpt || content.substring(0, 200) + '...',
        status,
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : tags) : null,
        featured
      });

      if (!updated) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Handle new image uploads if present
      let newImages = [];
      if (req.files && req.files.length > 0) {
        newImages = await saveImageRecords(req.db, 'article', id, req.files);
      }

      res.json({
        message: 'Article updated successfully',
        newImages: newImages.length
      });
    } catch (error) {
      console.error('Error updating article:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete article (admin only)
  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.articleModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('Error deleting article:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get featured articles (public)
  async getFeaturedArticles(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const offset = (page - 1) * limit;
      
      // Get featured articles and total count
      const [articles, totalCount] = await Promise.all([
        this.articleModel.getFeatured(limit, offset),
        this.articleModel.getFeaturedTotalCount()
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        articles,
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
      console.error('Error fetching featured articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get trending articles (popular by views, likes, and shares)
  async getTrendingArticles(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // Get trending articles and total count
      const [articles, totalCount] = await Promise.all([
        this.articleModel.getTrending(limit, offset),
        this.articleModel.getTrendingTotalCount()
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        articles,
        message: 'Trending articles based on popularity metrics',
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
      console.error('Error fetching trending articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search articles (public)
  async searchArticles(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Get search results and total count
      const [articles, totalCount] = await Promise.all([
        this.articleModel.search(q, limit, offset),
        this.articleModel.getSearchTotalCount(q)
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      res.json({
        articles,
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
      console.error('Error searching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get article statistics (admin only)
  async getArticleStats(req, res) {
    try {
      const { id } = req.params;
      
      const views = await this.statisticsModel.getCount('article', id, 'view');
      const allStats = await this.statisticsModel.getByEntity('article', id);
      
      // Group by action
      const statsSummary = allStats.reduce((acc, stat) => {
        if (!acc[stat.action]) acc[stat.action] = 0;
        acc[stat.action]++;
        return acc;
      }, {});

      res.json({
        articleId: id,
        totalViews: views,
        summary: statsSummary,
        recentActivity: allStats.slice(0, 50) // Last 50 activities
      });
    } catch (error) {
      console.error('Error fetching article statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete article (admin only)
  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Check if article exists
      const article = await this.articleModel.getById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Delete the article (this will also delete related images and statistics)
      const deleted = await this.articleModel.delete(id);
      
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete article' });
      }
      
      res.json({ 
        success: true,
        message: 'Article deleted successfully',
        deletedArticle: {
          id: article.id,
          title: article.title,
          author: article.author
        }
      });
    } catch (error) {
      console.error('Error deleting article:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

    // Like/Unlike article (public)
  async likeArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Check if article exists
      const article = await this.articleModel.getById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Get enhanced client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle like
      const result = await this.articleModel.toggleLike(id, clientInfo);
      
      // Get updated article data
      const updatedArticle = await this.articleModel.getById(id);
      
      res.json({
        success: true,
        message: `Article ${result.action} successfully`,
        liked: result.liked,
        like_count: updatedArticle.like_count
      });
    } catch (error) {
      console.error('Error toggling article like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has liked article (public)
  async checkArticleLike(req, res) {
    try {
      const { id } = req.params;
      
      // Get enhanced client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has liked this article
      const hasLiked = await this.articleModel.hasUserLiked(id, clientInfo);
      
      res.json({
        liked: hasLiked
      });
    } catch (error) {
      console.error('Error checking article like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Share/Unshare article (public)
  async shareArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Check if article exists
      const article = await this.articleModel.getById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Get enhanced client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle share
      const result = await this.articleModel.toggleShare(id, clientInfo);
      
      // Get updated article data
      const updatedArticle = await this.articleModel.getById(id);
      
      res.json({
        success: true,
        message: `Article ${result.action} successfully`,
        shared: result.shared,
        shared_count: updatedArticle.shared_count
      });
    } catch (error) {
      console.error('Error toggling article share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has shared article (public)
  async checkArticleShare(req, res) {
    try {
      const { id } = req.params;
      
      // Get enhanced client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has shared this article
      const hasShared = await this.articleModel.hasUserShared(id, clientInfo);
      
      res.json({
        shared: hasShared
      });
    } catch (error) {
      console.error('Error checking article share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has liked article (public)
  async checkArticleLike(req, res) {
    try {
      const { id } = req.params;
      
      // Get client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has liked this article
      const hasLiked = await this.articleModel.hasUserLiked(id, clientInfo.ip, clientInfo.userAgent);
      
      res.json({
        liked: hasLiked
      });
    } catch (error) {
      console.error('Error checking article like:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Share/Unshare article (public)
  async shareArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Check if article exists
      const article = await this.articleModel.getById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Get client info for unique identification
      const clientInfo = this.getClientInfo(req);
      
      // Toggle share
      const result = await this.articleModel.toggleShare(id, clientInfo.ip, clientInfo.userAgent);
      
      // Get updated article data
      const updatedArticle = await this.articleModel.getById(id);
      
      res.json({
        success: true,
        message: `Article ${result.action} successfully`,
        shared: result.shared,
        shared_count: updatedArticle.shared_count
      });
    } catch (error) {
      console.error('Error toggling article share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Check if user has shared article (public)
  async checkArticleShare(req, res) {
    try {
      const { id } = req.params;
      
      // Get client info
      const clientInfo = this.getClientInfo(req);
      
      // Check if user has shared this article
      const hasShared = await this.articleModel.hasUserShared(id, clientInfo.ip, clientInfo.userAgent);
      
      res.json({
        shared: hasShared
      });
    } catch (error) {
      console.error('Error checking article share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Increment share count (public - for external shares)
  async incrementArticleShare(req, res) {
    try {
      const { id } = req.params;
      
      // Check if article exists
      const article = await this.articleModel.getById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Increment share count
      await this.articleModel.incrementShareCount(id);
      
      // Get updated article data
      const updatedArticle = await this.articleModel.getById(id);
      
      res.json({
        success: true,
        message: 'Share count incremented',
        shared_count: updatedArticle.shared_count
      });
    } catch (error) {
      console.error('Error incrementing article share:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = ArticleController;
