const CitiesService = require('../services/citiesService');
const MegaService = require('../services/megaService');
const AttributesService = require('../services/attributesService');
const ProjectsService = require('../services/projectsService');
const logger = require('../utils/logger');

class SyncController {
  static async syncAll(req, res) {
    try {
        const citiesResult = await CitiesService.syncCities();
        const megaResult = await MegaService.syncMegaProjects();
        const attributesResult = await AttributesService.syncAttributes();
        const projectsResult = await ProjectsService.syncProjects();
        res.status(200).json({
            message: 'Sincronización completa',
            results: { cities: citiesResult, megaProjects: megaResult, attributes: attributesResult, projects: projectsResult },
        });
    } catch (error) {
        logger.error(`Error en sincronización completa: ${error.message}`);
        throw error;
    }
  }
}

module.exports = SyncController;