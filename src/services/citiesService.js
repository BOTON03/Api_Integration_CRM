const ZohoService = require('./zohoService');
const CitiesModel = require('../models/citiesModel');
const logger = require('../utils/logger');

class CitiesService {
  static async syncCities() {
    try {
      logger.info('Iniciando sincronización de ciudades');
      const query = {
        select_query: "SELECT Ciudad.Name, Ciudad.id FROM Proyectos_Comerciales WHERE Ciudad is not null limit 0, 200"
      };
      const { data: cities } = await ZohoService.executeCoqlQuery(query);

      if (!cities || cities.length === 0) {
        logger.info('No hay ciudades para sincronizar');
        return { processedCount: 0, errorCount: 0 };
      }

      const citiesMap = new Map();
      for (const city of cities) {
        if (city['Ciudad.id']) {
          citiesMap.set(city['Ciudad.id'], city);
        }
      }
      const uniqueCities = Array.from(citiesMap.values());
      logger.info(`Encontradas ${uniqueCities.length} ciudades únicas`);

      let processedCount = 0;
      let errorCount = 0;

      for (const city of uniqueCities) {
        const cityId = city['Ciudad.id'];
        const fullCityName = city['Ciudad.Name'];
        if (!cityId || !fullCityName) {
          logger.warn(`Registro inválido: ${JSON.stringify(city)}`);
          errorCount++;
          continue;
        }
        const cityName = fullCityName.split('/')[0].trim();
        if (!cityName) {
          logger.warn(`Nombre de ciudad vacío: "${fullCityName}"`);
          errorCount++;
          continue;
        }

        try {
          await CitiesModel.upsertCity(cityId, cityName);
          logger.info(`Ciudad ID ${cityId} ('${cityName}') procesada`);
          processedCount++;
        } catch (error) {
          if (error.code === '23505') {
            logger.error(`Error de unicidad para ciudad ID ${cityId}: ${error.detail}`);
          } else {
            logger.error(`Error al procesar ciudad ID ${cityId}: ${error.message}`);
          }
          errorCount++;
        }
      }

      logger.info(`Sincronización completada: ${processedCount} ciudades procesadas, ${errorCount} errores`);
      return { processedCount, errorCount };
    } catch (error) {
      logger.error(`Error crítico en sincronización de ciudades: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CitiesService;