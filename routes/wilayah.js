const express = require('express');
const WilayahController = require('../controllers/wilayahController');

module.exports = function createWilayahRoutes(dbPool) {
  const router = express.Router();
  const controller = new WilayahController(dbPool);

  // Base: list provinsi
  router.get('/provinsi', controller.getProvinsi.bind(controller));

  // Kab/Kota by prov
  router.get('/provinsi/:provCode/kabkota', controller.getKabKota.bind(controller));

  // Kecamatan by kab/kota
  router.get('/provinsi/:provCode/kabkota/:kabCode/kecamatan', controller.getKecamatan.bind(controller));

  // Kelurahan/Desa by kecamatan
  router.get('/provinsi/:provCode/kabkota/:kabCode/kecamatan/:kecCode/kelurahan', controller.getKelurahan.bind(controller));

  // Direct lookup and search
  router.get('/kode/:kode', controller.getByKode.bind(controller));
  router.get('/search', controller.search.bind(controller));

  return router;
};
