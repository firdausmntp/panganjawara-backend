const Statistics = require('../models/Statistics');

class StatsController {
  constructor(db) {
    this.statisticsModel = new Statistics(db);
    this.db = db;
  }

  // Get overall dashboard statistics (admin only)
  async getDashboardStats(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;

      // Get counts from different tables
      const [postCount] = await this.db.execute('SELECT COUNT(*) as count FROM posts');
      const [commentCount] = await this.db.execute('SELECT COUNT(*) as count FROM comments');
      const [articleCount] = await this.db.execute('SELECT COUNT(*) as count FROM articles');
      const [publishedArticleCount] = await this.db.execute('SELECT COUNT(*) as count FROM articles WHERE status = ?', ['published']);
      const [videoCount] = await this.db.execute('SELECT COUNT(*) as count FROM videos');
      const [publishedVideoCount] = await this.db.execute('SELECT COUNT(*) as count FROM videos WHERE status = ?', ['published']);

      // Get daily summary for the last N days
      const dailySummary = await this.statisticsModel.getDailySummary();

      // Get top content
      const topPosts = await this.statisticsModel.getTopContent('post', 'view', 10, days);
      const topArticles = await this.statisticsModel.getTopContent('article', 'view', 10, days);
      const topVideos = await this.statisticsModel.getTopContent('video', 'view', 10, days);

      // Get geographic distribution
      const geoStats = await this.statisticsModel.getGeographicStats(null, days);

      res.json({
        overview: {
          totalPosts: postCount[0].count,
          totalComments: commentCount[0].count,
          totalArticles: articleCount[0].count,
          publishedArticles: publishedArticleCount[0].count,
          totalVideos: videoCount[0].count,
          publishedVideos: publishedVideoCount[0].count
        },
        dailySummary: dailySummary.slice(0, days),
        topContent: {
          posts: topPosts,
          articles: topArticles,
          videos: topVideos
        },
        geographicDistribution: geoStats.slice(0, 20), // Top 20 locations
        period: `${days} days`
      });
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get content statistics by type (admin only)
  async getContentStats(req, res) {
    try {
      const { type } = req.params; // 'post', 'comment', 'article', 'video'
      const days = parseInt(req.query.days) || 30;

      if (!['post', 'comment', 'article', 'video'].includes(type)) {
        return res.status(400).json({ error: 'Invalid content type' });
      }

      // Get top performing content
      const topContent = await this.statisticsModel.getTopContent(type, 'view', 20, days);

      // Get daily summary for this content type
      const dailySummary = await this.statisticsModel.getDailySummary(null, type);

      // Get geographic distribution for this content type
      const geoStats = await this.statisticsModel.getGeographicStats(type, days);

      res.json({
        contentType: type,
        topPerformingContent: topContent,
        dailyActivity: dailySummary.slice(0, days),
        geographicDistribution: geoStats.slice(0, 15),
        period: `${days} days`
      });
    } catch (error) {
      console.error('Error fetching content statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get detailed statistics for specific content (admin only)
  async getDetailedStats(req, res) {
    try {
      const { type, id } = req.params;
      
      if (!['post', 'comment', 'article', 'video'].includes(type)) {
        return res.status(400).json({ error: 'Invalid content type' });
      }

      // Get all statistics for this specific content
      const allStats = await this.statisticsModel.getByEntity(type, id);

      // Group by action
      const actionSummary = allStats.reduce((acc, stat) => {
        if (!acc[stat.action]) {
          acc[stat.action] = {
            count: 0,
            uniqueIPs: new Set(),
            countries: {},
            cities: {}
          };
        }
        
        acc[stat.action].count++;
        if (stat.ip_address) acc[stat.action].uniqueIPs.add(stat.ip_address);
        if (stat.country) {
          acc[stat.action].countries[stat.country] = (acc[stat.action].countries[stat.country] || 0) + 1;
        }
        if (stat.city) {
          acc[stat.action].cities[stat.city] = (acc[stat.action].cities[stat.city] || 0) + 1;
        }
        
        return acc;
      }, {});

      // Convert Sets to counts
      Object.keys(actionSummary).forEach(action => {
        actionSummary[action].uniqueUsers = actionSummary[action].uniqueIPs.size;
        delete actionSummary[action].uniqueIPs;
      });

      // Get hourly distribution
      const hourlyStats = allStats.reduce((acc, stat) => {
        const hour = new Date(stat.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      res.json({
        contentType: type,
        contentId: id,
        totalInteractions: allStats.length,
        actionBreakdown: actionSummary,
        hourlyDistribution: hourlyStats,
        recentActivity: allStats.slice(0, 50) // Last 50 interactions
      });
    } catch (error) {
      console.error('Error fetching detailed statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get image usage statistics (admin only)
  async getImageStats(req, res) {
    try {
      // Get image counts by entity type
      const [imageStats] = await this.db.execute(`
        SELECT 
          entity_type,
          COUNT(*) as image_count,
          SUM(size) as total_size,
          AVG(size) as avg_size
        FROM images 
        GROUP BY entity_type
      `);

      // Get top image formats
      const [formatStats] = await this.db.execute(`
        SELECT 
          mimetype,
          COUNT(*) as count,
          SUM(size) as total_size
        FROM images 
        GROUP BY mimetype 
        ORDER BY count DESC
      `);

      // Get recent uploads
      const [recentUploads] = await this.db.execute(`
        SELECT entity_type, entity_id, filename, size, created_at
        FROM images 
        ORDER BY created_at DESC 
        LIMIT 20
      `);

      res.json({
        imagesByType: imageStats,
        formatBreakdown: formatStats,
        recentUploads,
        summary: {
          totalImages: imageStats.reduce((sum, stat) => sum + stat.image_count, 0),
          totalStorage: imageStats.reduce((sum, stat) => sum + stat.total_size, 0)
        }
      });
    } catch (error) {
      console.error('Error fetching image statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Clean old statistics (admin only)
  async cleanOldStats(req, res) {
    try {
      const daysToKeep = parseInt(req.query.days) || 365;
      const deletedCount = await this.statisticsModel.cleanOldStats(daysToKeep);
      
      res.json({
        message: `Successfully cleaned old statistics`,
        deletedRecords: deletedCount,
        keptRecords: `Last ${daysToKeep} days`
      });
    } catch (error) {
      console.error('Error cleaning old statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get popular content based on views (public endpoint)
  async getPopularContent(req, res) {
    try {
      const type = req.params.type; // 'posts' or 'articles' or 'videos' or 'all'
      const limit = parseInt(req.query.limit) || 10;

      let results = {};

      if (type === 'posts' || type === 'all') {
        const [popularPosts] = await this.db.execute(`
          SELECT p.id, p.title, p.author, p.view_count, p.like_count, p.shared_count, p.created_at,
            (SELECT COUNT(*) FROM images WHERE entity_type = 'post' AND entity_id = p.id) as image_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p
          WHERE p.view_count > 0
          ORDER BY p.view_count DESC 
          LIMIT ?
        `, [limit]);
        results.posts = popularPosts;
      }

      if (type === 'articles' || type === 'all') {
        const [popularArticles] = await this.db.execute(`
          SELECT a.id, a.title, a.author, a.view_count, a.like_count, a.shared_count, a.status, a.featured, a.created_at,
            (SELECT COUNT(*) FROM images WHERE entity_type = 'article' AND entity_id = a.id) as image_count,
            0 as comment_count
          FROM articles a
          WHERE a.view_count > 0 AND a.status = 'published'
          ORDER BY a.view_count DESC 
          LIMIT ?
        `, [limit]);
        results.articles = popularArticles;
      }

      if (type === 'videos' || type === 'all') {
        const [popularVideos] = await this.db.execute(`
          SELECT v.id, v.title, v.author, v.view_count, v.like_count, v.status, v.featured, v.created_at,
            v.youtube_url, v.thumbnail_url, v.duration, v.tags
          FROM videos v
          WHERE v.view_count > 0 AND v.status = 'published'
          ORDER BY v.view_count DESC 
          LIMIT ?
        `, [limit]);
        results.videos = popularVideos;
      }

      res.json({
        message: 'Popular content retrieved successfully',
        data: results,
        type: type,
        limit: limit
      });
    } catch (error) {
      console.error('Error fetching popular content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = StatsController;
