const ProjectsService = require('../services/projectsService');
const logger = require('../utils/logger');

class ProjectsController {
  static async syncProjects(req, res) {
    try {
      const result = await ProjectsService.syncProjects();
      res.status(200).json({
        message: 'Sincronización de proyectos completada',
        ...result,
      });
    } catch (error) {
      logger.error(`Error en controlador de proyectos: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ProjectsController;