class Wilayah {
  constructor(db) {
    this.db = db;
  }

  // Helper: count dots in kode
  dotCountExpr() {
    // PostgreSQL-compatible; counts '.' characters in kode
    return "LENGTH(kode) - LENGTH(REPLACE(kode, '.', ''))";
  }

  async getProvinsi() {
    const query = `
      SELECT kode, nama
      FROM wilayah
      WHERE kode NOT LIKE '%.%'
      ORDER BY kode
    `;
    const [rows] = await this.db.execute(query);
    return rows;
  }

  async getKabKota(provCode) {
    const query = `
      SELECT kode, nama
      FROM wilayah
      WHERE kode LIKE (? || '.%')
        AND ${this.dotCountExpr()} = 1
      ORDER BY kode
    `;
    const [rows] = await this.db.execute(query, [provCode]);
    return rows;
  }

  async getKecamatan(provCode, kabCode) {
    const prefix = `${provCode}.${kabCode}`;
    const query = `
      SELECT kode, nama
      FROM wilayah
      WHERE kode LIKE (? || '.%')
        AND ${this.dotCountExpr()} = 2
      ORDER BY kode
    `;
    const [rows] = await this.db.execute(query, [prefix]);
    return rows;
  }

  async getKelurahan(provCode, kabCode, kecCode) {
    const prefix = `${provCode}.${kabCode}.${kecCode}`;
    const query = `
      SELECT kode, nama
      FROM wilayah
      WHERE kode LIKE (? || '.%')
        AND ${this.dotCountExpr()} = 3
      ORDER BY kode
    `;
    const [rows] = await this.db.execute(query, [prefix]);
    return rows;
  }

  async getByKode(kode) {
    const [rows] = await this.db.execute('SELECT kode, nama FROM wilayah WHERE kode = ?', [kode]);
    return rows[0] || null;
  }

  async search(term, limit = 20) {
    const like = `%${term}%`;
    const [rows] = await this.db.execute(
      `SELECT kode, nama FROM wilayah
       WHERE nama LIKE ? OR kode LIKE ?
       ORDER BY nama LIMIT ?`,
      [like, like, limit]
    );
    return rows;
  }
}

module.exports = Wilayah;
