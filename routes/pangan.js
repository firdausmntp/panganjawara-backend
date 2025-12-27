const express = require('express');
const axios = require('axios');

const API_BASE = 'https://api-panelhargav2.badanpangan.go.id/api';
const DEFAULT_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Sec-Ch-Ua': '"Chromium";v="121", "Not A(Brand";v="99", "Google Chrome";v="121"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Origin': process.env.PANGAN_ORIGIN || 'https://panelharga.badanpangan.go.id',
  'Referer': process.env.PANGAN_REFERER || 'https://panelharga.badanpangan.go.id/'
};

const REQUEST_TIMEOUT = parseInt(process.env.PANGAN_API_TIMEOUT_MS, 10) || 15000;
const DEFAULT_CACHE_TTL = parseInt(process.env.PANGAN_CACHE_TTL_MS, 10) || 5 * 60 * 1000; // 5 minutes
const PRICE_CACHE_TTL = parseInt(process.env.PANGAN_PRICE_CACHE_TTL_MS, 10) || 60 * 1000; // 1 minute

const cache = {
  provinces: { data: null, expiresAt: 0 },
  cities: new Map(),
  prices: new Map()
};

function handleProxyError(res, error, fallbackMessage) {
  const status = error?.response?.status || 502;
  const payload = error?.response?.data;
  if (payload) {
    if (typeof payload === 'object') {
      return res.status(status).json(payload);
    }
    return res.status(status).json({ error: payload, status });
  }
  console.error('[Pangan] upstream error:', error?.message || fallbackMessage);
  return res.status(status).json({ error: fallbackMessage, status });
}

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function setCache(entry, data, ttl = DEFAULT_CACHE_TTL) {
  entry.data = data;
  entry.expiresAt = Date.now() + ttl;
}

function createKeyFromParams(params) {
  return JSON.stringify(Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {}));
}

function createPanganRoutes() {
  const router = express.Router();

  router.get('/provinces', async (req, res) => {
    try {
      if (isCacheValid(cache.provinces)) {
        return res.json(cache.provinces.data);
      }

      const response = await axios.get(`${API_BASE}/provinces`, {
        params: { search: req.query.search || '' },
        headers: DEFAULT_HEADERS,
        timeout: REQUEST_TIMEOUT
      });

      const data = response.data?.data || [];
      setCache(cache.provinces, data);
      res.json(data);
    } catch (error) {
      handleProxyError(res, error, 'Gagal memuat provinsi');
    }
  });

  router.get('/cities', async (req, res) => {
    const provinceId = req.query.province_id || req.query.provinceId;
    if (!provinceId) {
      return res.status(400).json({ error: 'province_id is required' });
    }

    try {
      const cached = cache.cities.get(provinceId);
      if (isCacheValid(cached)) {
        return res.json(cached.data);
      }

      const response = await axios.get(`${API_BASE}/cities`, {
        params: { province_id: provinceId },
        headers: DEFAULT_HEADERS,
        timeout: REQUEST_TIMEOUT
      });

      const payload = response.data?.data?.data || [];
      cache.cities.set(provinceId, {
        data: payload,
        expiresAt: Date.now() + DEFAULT_CACHE_TTL
      });
      res.json(payload);
    } catch (error) {
      handleProxyError(res, error, 'Gagal memuat kab/kota');
    }
  });

  router.get('/harga', async (req, res) => {
    const levelHargaId = req.query.level_harga_id;
    if (!levelHargaId) {
      return res.status(400).json({ error: 'level_harga_id is required' });
    }

    const params = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const cacheKey = createKeyFromParams(Object.fromEntries(params));
    const cached = cache.prices.get(cacheKey);
    if (isCacheValid(cached)) {
      return res.json(cached.data);
    }

    try {
      const response = await axios.get(`${API_BASE}/front/harga-pangan-informasi`, {
        params,
        headers: DEFAULT_HEADERS,
        timeout: REQUEST_TIMEOUT
      });

      const data = response.data?.data || [];
      cache.prices.set(cacheKey, {
        data,
        expiresAt: Date.now() + PRICE_CACHE_TTL
      });
      res.json(data);
    } catch (error) {
      handleProxyError(res, error, 'Gagal memuat data harga pangan');
    }
  });

  return router;
}

module.exports = createPanganRoutes;
