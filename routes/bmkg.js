const express = require('express');
const axios = require('axios');

const API_BASE = 'https://api.bmkg.go.id/publik';
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; PanganJawaraBot/1.0)'
};
const REQUEST_TIMEOUT = parseInt(process.env.BMKG_API_TIMEOUT_MS, 10) || 15000;
const CACHE_TTL = parseInt(process.env.BMKG_CACHE_TTL_MS, 10) || 5 * 60 * 1000; // 5 minutes

const forecastCache = new Map();

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function createCacheKey(params) {
  const normalized = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return JSON.stringify(normalized);
}

function createBmkgRoutes() {
  const router = express.Router();

  router.get('/prakiraan-cuaca', async (req, res) => {
    const { adm4 } = req.query;
    if (!adm4) {
      return res.status(400).json({ error: 'adm4 parameter is required' });
    }

    const cacheKey = createCacheKey(req.query);
    const cached = forecastCache.get(cacheKey);
    if (isCacheValid(cached)) {
      return res.json(cached.data);
    }

    try {
      const response = await axios.get(`${API_BASE}/prakiraan-cuaca`, {
        params: req.query,
        headers: DEFAULT_HEADERS,
        timeout: REQUEST_TIMEOUT
      });

      const payload = response.data;
      forecastCache.set(cacheKey, {
        data: payload,
        expiresAt: Date.now() + CACHE_TTL
      });

      res.json(payload);
    } catch (error) {
      console.error('[BMKG] prakiraan-cuaca error:', error.message);
      res.status(502).json({ error: error.message || 'Gagal memuat prakiraan cuaca' });
    }
  });

  return router;
}

module.exports = createBmkgRoutes;
