class Video {
  constructor(db) {
    this.db = db;
  }

  // Helper untuk extract YouTube video ID dari URL
  extractYouTubeId(url) {
    if (!url) return null;
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // Helper untuk generate thumbnail URL dari video ID
  getThumbnailUrl(videoId) {
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  }

  // Membuat video baru
  async create(videoData) {
    const { 
      title, 
      description, 
      author, 
      status = 'draft', 
      tags, 
      youtube_url,
      duration,
      featured = false
    } = videoData;

    const youtube_video_id = this.extractYouTubeId(youtube_url);
    const thumbnail_url = this.getThumbnailUrl(youtube_video_id);

    const query = `
      INSERT INTO videos (
        title, description, author, status, tags, 
        youtube_url, youtube_video_id, thumbnail_url, 
        duration, featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const [result] = await this.db.execute(query, [
      title, 
      description || null, 
      author, 
      status, 
      tags || null,
      youtube_url, 
      youtube_video_id, 
      thumbnail_url,
      duration || null, 
      featured
    ]);
    
    return result.insertId;
  }

  // Mendapatkan semua video dengan paginasi
  async getAll(limit = 10, offset = 0, status = null) {
    let query = `
      SELECT * FROM videos 
    `;
    const params = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await this.db.execute(query, params);
    return rows;
  }

  // Mendapatkan video berdasarkan ID
  async getById(id) {
    const query = 'SELECT * FROM videos WHERE id = ?';
    const [rows] = await this.db.execute(query, [id]);
    return rows[0];
  }

  // Update video
  async update(id, videoData) {
    const { 
      title, 
      description, 
      author, 
      status, 
      tags, 
      youtube_url,
      duration,
      featured
    } = videoData;

    const youtube_video_id = this.extractYouTubeId(youtube_url);
    const thumbnail_url = this.getThumbnailUrl(youtube_video_id);

    const query = `
      UPDATE videos SET 
        title = ?, description = ?, author = ?, status = ?, 
        tags = ?, youtube_url = ?, youtube_video_id = ?, 
        thumbnail_url = ?, duration = ?, featured = ?,
        updated_at = NOW(),
        published_at = CASE 
          WHEN status = 'published' AND published_at IS NULL 
          THEN NOW() 
          ELSE published_at 
        END
      WHERE id = ?
    `;

    const [result] = await this.db.execute(query, [
      title, 
      description || null, 
      author, 
      status, 
      tags || null,
      youtube_url, 
      youtube_video_id, 
      thumbnail_url,
      duration || null, 
      featured, 
      id
    ]);

    return result.affectedRows > 0;
  }

  // Hapus video
  async delete(id) {
    const query = 'DELETE FROM videos WHERE id = ?';
    const [result] = await this.db.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Mendapatkan video yang featured
  async getFeatured(limit = 5) {
    const query = `
      SELECT * FROM videos 
      WHERE status = 'published' AND featured = true 
      ORDER BY published_at DESC 
      LIMIT ?
    `;
    const [rows] = await this.db.execute(query, [limit]);
    return rows;
  }

  // Mendapatkan video trending (berdasarkan view_count)
  async getTrending(limit = 10) {
    const query = `
      SELECT * FROM videos 
      WHERE status = 'published' 
      ORDER BY view_count DESC, published_at DESC 
      LIMIT ?
    `;
    const [rows] = await this.db.execute(query, [limit]);
    return rows;
  }

  // Search videos
  async search(searchTerm, limit = 10, offset = 0) {
    const query = `
      SELECT * FROM videos 
      WHERE status = 'published' 
      AND (title LIKE ? OR description LIKE ? OR tags LIKE ?) 
      ORDER BY published_at DESC 
      LIMIT ? OFFSET ?
    `;
    const searchPattern = `%${searchTerm}%`;
    const [rows] = await this.db.execute(query, [
      searchPattern, searchPattern, searchPattern, limit, offset
    ]);
    return rows;
  }

  // Increment view count
  async incrementViewCount(id) {
    const query = 'UPDATE videos SET view_count = view_count + 1 WHERE id = ?';
    const [result] = await this.db.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Like/Unlike video
  async toggleLike(id) {
    const query = 'UPDATE videos SET like_count = like_count + 1 WHERE id = ?';
    const [result] = await this.db.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Get video statistics
  async getStats(id) {
    const query = `
      SELECT 
        view_count,
        like_count,
        created_at,
        published_at,
        status
      FROM videos 
      WHERE id = ?
    `;
    const [rows] = await this.db.execute(query, [id]);
    return rows[0];
  }

  // Get total count untuk pagination
  async getTotalCount(status = null) {
    let query = 'SELECT COUNT(*) as total FROM videos';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    const [rows] = await this.db.execute(query, params);
    return rows[0].total;
  }
}

module.exports = Video;
