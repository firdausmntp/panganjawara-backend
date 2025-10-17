const Video = require('../models/Video');
const Statistics = require('../models/Statistics');
const geoip = require('geoip-lite');

class VideoController {
  constructor(db) {
    this.videoModel = new Video(db);
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

  // Membuat video baru (admin only)
  async createVideo(req, res) {
    try {
      const { 
        title, 
        description, 
        author, 
        status = 'draft', 
        tags, 
        youtube_url,
        duration,
        featured = false
      } = req.body;
      
      // Validasi input
      if (!title || !youtube_url || !author) {
        return res.status(400).json({ 
          error: 'Title, YouTube URL, and author are required' 
        });
      }

      // Validasi YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
      if (!youtubeRegex.test(youtube_url)) {
        return res.status(400).json({
          error: 'Invalid YouTube URL format'
        });
      }

      const videoId = await this.videoModel.create({
        title,
        description,
        author,
        status,
        tags,
        youtube_url,
        duration,
        featured
      });

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_create', videoId, clientInfo);

      const video = await this.videoModel.getById(videoId);
      res.status(201).json({
        success: true,
        message: 'Video created successfully',
        data: video
      });
    } catch (error) {
      console.error('Create video error:', error);
      res.status(500).json({ error: 'Failed to create video' });
    }
  }

  // Mendapatkan semua video (admin only)
  async getAllVideos(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || null;
      const offset = (page - 1) * limit;

      const videos = await this.videoModel.getAll(limit, offset, status);
      const total = await this.videoModel.getTotalCount(status);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: videos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Get all videos error:', error);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  }

  // Mendapatkan video berdasarkan ID (admin only)
  async getVideoById(req, res) {
    try {
      const { id } = req.params;
      const video = await this.videoModel.getById(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Increment view count
      await this.videoModel.incrementViewCount(id);

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_view', parseInt(id), clientInfo);

      res.json({
        success: true,
        data: video
      });
    } catch (error) {
      console.error('Get video error:', error);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  }

  // Update video (admin only)
  async updateVideo(req, res) {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        author, 
        status, 
        tags, 
        youtube_url,
        thumbnail_url,  // Accept custom thumbnail
        duration,
        featured
      } = req.body;

      // Check if video exists
      const existingVideo = await this.videoModel.getById(id);
      if (!existingVideo) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Validasi YouTube URL jika diubah
      if (youtube_url && youtube_url !== existingVideo.youtube_url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
        if (!youtubeRegex.test(youtube_url)) {
          return res.status(400).json({
            error: 'Invalid YouTube URL format'
          });
        }
      }

      // Determine the final youtube_url to use
      const finalYoutubeUrl = youtube_url || existingVideo.youtube_url;

      const success = await this.videoModel.update(id, {
        title: title || existingVideo.title,
        description: description !== undefined ? description : existingVideo.description,
        author: author || existingVideo.author,
        status: status || existingVideo.status,
        tags: tags !== undefined ? tags : existingVideo.tags,
        youtube_url: finalYoutubeUrl,
        thumbnail_url: thumbnail_url,  // Pass custom thumbnail
        duration: duration !== undefined ? duration : existingVideo.duration,
        featured: featured !== undefined ? featured : existingVideo.featured
      });

      if (!success) {
        return res.status(400).json({ error: 'Failed to update video' });
      }

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_update', parseInt(id), clientInfo);

      const updatedVideo = await this.videoModel.getById(id);
      res.json({
        success: true,
        message: 'Video updated successfully',
        data: updatedVideo
      });
    } catch (error) {
      console.error('Update video error:', error);
      res.status(500).json({ error: 'Failed to update video' });
    }
  }

  // Hapus video (admin only)
  async deleteVideo(req, res) {
    try {
      const { id } = req.params;

      // Check if video exists
      const existingVideo = await this.videoModel.getById(id);
      if (!existingVideo) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const success = await this.videoModel.delete(id);

      if (!success) {
        return res.status(400).json({ error: 'Failed to delete video' });
      }

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_delete', parseInt(id), clientInfo);

      res.json({
        success: true,
        message: 'Video deleted successfully'
      });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  }

  // Get video statistics (admin only)
  async getVideoStats(req, res) {
    try {
      const { id } = req.params;
      const stats = await this.videoModel.getStats(id);

      if (!stats) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get video stats error:', error);
      res.status(500).json({ error: 'Failed to fetch video statistics' });
    }
  }

  // Get featured videos (admin only)
  async getFeaturedVideos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const videos = await this.videoModel.getFeatured(limit);

      res.json({
        success: true,
        data: videos
      });
    } catch (error) {
      console.error('Get featured videos error:', error);
      res.status(500).json({ error: 'Failed to fetch featured videos' });
    }
  }

  // Get trending videos (admin only)
  async getTrendingVideos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const videos = await this.videoModel.getTrending(limit);

      res.json({
        success: true,
        data: videos
      });
    } catch (error) {
      console.error('Get trending videos error:', error);
      res.status(500).json({ error: 'Failed to fetch trending videos' });
    }
  }

  // Search videos (admin only)
  async searchVideos(req, res) {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const videos = await this.videoModel.search(q.trim(), limit, offset);

      res.json({
        success: true,
        data: videos,
        query: q,
        pagination: {
          page,
          limit,
          hasResults: videos.length > 0
        }
      });
    } catch (error) {
      console.error('Search videos error:', error);
      res.status(500).json({ error: 'Failed to search videos' });
    }
  }

  // Like video (admin only)
  async likeVideo(req, res) {
    try {
      const { id } = req.params;

      // Check if video exists
      const video = await this.videoModel.getById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      await this.videoModel.toggleLike(id);

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_like', parseInt(id), clientInfo);

      const updatedVideo = await this.videoModel.getById(id);
      res.json({
        success: true,
        message: 'Video liked successfully',
        data: {
          like_count: updatedVideo.like_count
        }
      });
    } catch (error) {
      console.error('Like video error:', error);
      res.status(500).json({ error: 'Failed to like video' });
    }
  }

  // === PUBLIC VIDEO METHODS ===

  // Mendapatkan semua video published (public)
  async getPublicVideos(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Only show published videos for public
      const videos = await this.videoModel.getAll(limit, offset, 'published');
      const total = await this.videoModel.getTotalCount('published');
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: videos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Get public videos error:', error);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  }

  // Mendapatkan video berdasarkan ID (public - hanya published)
  async getPublicVideoById(req, res) {
    try {
      const { id } = req.params;
      const video = await this.videoModel.getById(id);

      if (!video || video.status !== 'published') {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Increment view count
      await this.videoModel.incrementViewCount(id);

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_view', parseInt(id), clientInfo);

      res.json({
        success: true,
        data: video
      });
    } catch (error) {
      console.error('Get public video error:', error);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  }

  // Get featured videos (public - hanya published)
  async getPublicFeaturedVideos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const videos = await this.videoModel.getFeatured(limit);

      res.json({
        success: true,
        data: videos
      });
    } catch (error) {
      console.error('Get public featured videos error:', error);
      res.status(500).json({ error: 'Failed to fetch featured videos' });
    }
  }

  // Get trending videos (public - hanya published)
  async getPublicTrendingVideos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const videos = await this.videoModel.getTrending(limit);

      res.json({
        success: true,
        data: videos
      });
    } catch (error) {
      console.error('Get public trending videos error:', error);
      res.status(500).json({ error: 'Failed to fetch trending videos' });
    }
  }

  // Search videos (public - hanya published)
  async searchPublicVideos(req, res) {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const videos = await this.videoModel.search(q.trim(), limit, offset);

      res.json({
        success: true,
        data: videos,
        query: q,
        pagination: {
          page,
          limit,
          hasResults: videos.length > 0
        }
      });
    } catch (error) {
      console.error('Search public videos error:', error);
      res.status(500).json({ error: 'Failed to search videos' });
    }
  }

  // Like video (public - hanya published)
  async likePublicVideo(req, res) {
    try {
      const { id } = req.params;

      // Check if video exists and is published
      const video = await this.videoModel.getById(id);
      if (!video || video.status !== 'published') {
        return res.status(404).json({ error: 'Video not found' });
      }

      await this.videoModel.toggleLike(id);

      // Log statistics
      const clientInfo = this.getClientInfo(req);
      await this.statisticsModel.logAction('video_like', parseInt(id), clientInfo);

      const updatedVideo = await this.videoModel.getById(id);
      res.json({
        success: true,
        message: 'Video liked successfully',
        data: {
          like_count: updatedVideo.like_count
        }
      });
    } catch (error) {
      console.error('Like public video error:', error);
      res.status(500).json({ error: 'Failed to like video' });
    }
  }
}

module.exports = VideoController;
