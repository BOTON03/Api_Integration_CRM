const CitiesService = require('../services/citiesService');
const logger = require('../utils/logger');

class CitiesController {
  static async syncCities(req, res) {
    try {
      const result = await CitiesService.syncCities();
      res.status(200).json({
        message: 'Sincronización de ciudades completada',
        ...result,
      });
    } catch (error) {
      logger.error(`Error en controlador de ciudades: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CitiesController;