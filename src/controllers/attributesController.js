const AttributesService = require('../services/attributesService');
const logger = require('../utils/logger');

class AttributesController {
  static async syncAttributes(req, res) {
    try {
      const result = await AttributesService.syncAttributes();
      res.status(200).json({
        message: 'Sincronización de atributos completada',
        ...result,
      });
    } catch (error) {
      logger.error(`Error en controlador de atributos: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AttributesController;