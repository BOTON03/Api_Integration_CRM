const ZohoService = require('./zohoService.js');
const AttributesModel = require('../models/attributesModel.js');
const logger = require('../utils/logger');

class AttributesService {
  static async syncAttributes() {
    try {
      logger.info('Iniciando sincronización de atributos');
      const query = {
        select_query: "select id, Nombre_atributo from Parametros where Tipo ='Atributo' limit 0,200"
      };
      const { data: attributes } = await ZohoService.executeCoqlQuery(query);

      if (!attributes || attributes.length === 0) {
        logger.info('No hay atributos para sincronizar');
        return { processedCount: 0, errorCount: 0 };
      }

      let processedCount = 0;
      let errorCount = 0;

      for (const attr of attributes) {
        if (!attr.id || !attr.Nombre_atributo) {
          logger.warn(`Atributo inválido: ${JSON.stringify(attr)}`);
          errorCount++;
          continue;
        }

        try {
          const attrId = String(attr.id); // Convertir ID a cadena
          await AttributesModel.upsertAttribute(attrId, attr.Nombre_atributo);
          logger.info(`Atributo ID ${attrId} procesado`);
          processedCount++;
        } catch (error) {
          logger.error(`Error al procesar atributo ID ${attr.id}: ${error.message}`);
          errorCount++;
        }
      }

      logger.info(`Sincronización completada: ${processedCount} atributos procesados, ${errorCount} errores`);
      return { processedCount, errorCount };
    } catch (error) {
      logger.error(`Error crítico en sincronización de atributos: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AttributesService;