const Wilayah = require('../models/Wilayah');

class WilayahController {
  constructor(db) {
    this.model = new Wilayah(db);
  }

  async getProvinsi(req, res) {
    try {
      const data = await this.model.getProvinsi();
      res.json({ items: data });
    } catch (e) {
      console.error('getProvinsi error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getKabKota(req, res) {
    try {
      const { provCode } = req.params;
      if (!provCode || provCode.includes('.')) {
        return res.status(400).json({ error: 'Invalid provCode. Expected code without dots, e.g., 11' });
      }
      const data = await this.model.getKabKota(provCode);
      res.json({ items: data });
    } catch (e) {
      console.error('getKabKota error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getKecamatan(req, res) {
    try {
      const { provCode, kabCode } = req.params;
      if (!provCode || provCode.includes('.') || !kabCode || kabCode.includes('.')) {
        return res.status(400).json({ error: 'Invalid codes. Use provCode and kabCode without dots, e.g., 11 and 02' });
      }
      const data = await this.model.getKecamatan(provCode, kabCode);
      res.json({ items: data });
    } catch (e) {
      console.error('getKecamatan error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getKelurahan(req, res) {
    try {
      const { provCode, kabCode, kecCode } = req.params;
      const invalid = [provCode, kabCode, kecCode].some(c => !c || c.includes('.'));
      if (invalid) {
        return res.status(400).json({ error: 'Invalid codes. Use codes without dots, e.g., 11, 02, 05' });
      }
      const data = await this.model.getKelurahan(provCode, kabCode, kecCode);
      res.json({ items: data });
    } catch (e) {
      console.error('getKelurahan error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getByKode(req, res) {
    try {
      const { kode } = req.params;
      const row = await this.model.getByKode(kode);
      if (!row) return res.status(404).json({ error: 'Kode not found' });
      res.json(row);
    } catch (e) {
      console.error('getByKode error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async search(req, res) {
    try {
      const q = (req.query.q || '').trim();
      if (!q) return res.status(400).json({ error: 'Query q is required' });
      const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
      const data = await this.model.search(q, limit);
      res.json({ items: data });
    } catch (e) {
      console.error('search wilayah error', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = WilayahController;
