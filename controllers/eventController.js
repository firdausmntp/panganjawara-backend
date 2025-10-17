const Event = require('../models/Event');
const { saveImageRecords } = require('../utils/upload');

class EventController {
  constructor(db) {
    this.eventModel = new Event(db);
    this.db = db;
  }

  // Create new event (admin/superadmin only)
  async createEvent(req, res) {
    try {
      const { 
        title, 
        description, 
        event_date, 
        duration_minutes, 
        location, 
        zoom_link, 
        zoom_meeting_id, 
        zoom_password, 
        max_participants, 
        status, 
        priority,
        created_by  // Accept created_by from request body
      } = req.body;

      if (!title || !event_date) {
        return res.status(400).json({ error: 'Title and event_date are required' });
      }

      const eventData = {
        title,
        description: description || null,
        event_date,
        duration_minutes: duration_minutes ? parseInt(duration_minutes) : 60,
        location: location || null,
        zoom_link: zoom_link || null,
        zoom_meeting_id: zoom_meeting_id || null,
        zoom_password: zoom_password || null,
        max_participants: max_participants ? parseInt(max_participants) : null,
        status: status || 'draft',
        priority: priority || 'normal',
        created_by: created_by || (req.user ? req.user.username : 'admin')
      };

      const eventId = await this.eventModel.create(eventData);

      // Handle image uploads if present
      let images = [];
      if (req.files && req.files.length > 0) {
        images = await saveImageRecords(req.db, 'event', eventId, req.files);
      }

      res.status(201).json({
        message: 'Event created successfully',
        eventId,
        imagesUploaded: images.length
      });
    } catch (error) {
      console.error('Error creating event:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all events (admin/superadmin)
  async getAllEvents(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.priority) filters.priority = req.query.priority;
      if (req.query.upcoming === 'true') filters.upcoming = true;
      if (req.query.past === 'true') filters.past = true;
      if (req.query.today === 'true') filters.today = true;

      const events = await this.eventModel.getAll(limit, offset, filters);
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get upcoming events (public)
  async getUpcomingEvents(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const events = await this.eventModel.getUpcoming(limit);
      res.json(events);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get event by ID (public for published, admin for all)
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const event = await this.eventModel.getById(id);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // If not admin/superadmin, only show published events
      if (!req.user && event.status !== 'published') {
        return res.status(403).json({ error: 'Event not available' });
      }

      res.json(event);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update event (admin/superadmin only)
  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        event_date, 
        duration_minutes, 
        location, 
        zoom_link, 
        zoom_meeting_id, 
        zoom_password, 
        max_participants, 
        status, 
        priority 
      } = req.body;

      const eventData = {
        title,
        description,
        event_date,
        duration_minutes: duration_minutes ? parseInt(duration_minutes) : undefined,
        location,
        zoom_link,
        zoom_meeting_id,
        zoom_password,
        max_participants: max_participants ? parseInt(max_participants) : null,
        status,
        priority
      };

      const updated = await this.eventModel.update(id, eventData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Handle new image uploads if present
      let newImages = [];
      if (req.files && req.files.length > 0) {
        newImages = await saveImageRecords(req.db, 'event', id, req.files);
      }

      res.json({
        message: 'Event updated successfully',
        newImages: newImages.length
      });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete event (admin/superadmin only)
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.eventModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search events (public)
  async searchEvents(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const events = await this.eventModel.search(q, limit, offset);
      res.json(events);
    } catch (error) {
      console.error('Error searching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get events by date range (admin/superadmin)
  async getEventsByDateRange(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }

      const status = req.query.status;
      const events = await this.eventModel.getByDateRange(start_date, end_date, status);
      res.json(events);
    } catch (error) {
      console.error('Error fetching events by date range:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get events statistics (admin/superadmin)
  async getEventStats(req, res) {
    try {
      const stats = await this.eventModel.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching event statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Helper method to get client information
  getClientInfo(req) {
    return {
      ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
          (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };
  }
}

module.exports = EventController;
