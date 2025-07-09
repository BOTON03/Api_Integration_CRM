const MegaService = require('../services/megaService');
const logger = require('../utils/logger');

class MegaController {
  static async syncMegaProjects(req, res) {
    try {
      const result = await MegaService.syncMegaProjects();
      res.status(200).json({
        message: 'Sincronización de mega proyectos completada',
        ...result,
      });
    } catch (error) {
      logger.error(`Error en controlador de mega proyectos: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MegaController;