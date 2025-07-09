const express = require('express');
const CitiesController = require('../controllers/citiesController');
const MegaController = require('../controllers/megaController');
const AttributesController = require('../controllers/attributesController');
const ProjectsController = require('../controllers/projectsController');
const SyncController = require('../controllers/syncController');

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Conexión exitosa Microservicio API LOCALHOST 6000!');
});

router.post('/sync/cities', CitiesController.syncCities);
router.post('/sync/mega', MegaController.syncMegaProjects);
router.post('/sync/attributes', AttributesController.syncAttributes);
router.post('/sync/projects', ProjectsController.syncProjects);
router.post('/sync/all', SyncController.syncAll); // Sincroniza todas las tablas [Cities, MegaProjects, Attributes, Projects]

module.exports = router;