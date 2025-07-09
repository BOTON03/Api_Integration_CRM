const ZohoService = require('./zohoService');
const MegaModel = require('../models/megaModel');
const logger = require('../utils/logger');

class MegaService {
  static async syncMegaProjects() {
    try {
      logger.info('Iniciando sincronización de mega proyectos');
      let offset = 0;
      let more = true;
      let totalProcessed = 0;
      let totalInserted = 0;

      while (more) {
        const query = {
          select_query: `
            SELECT id, Name, Direccion_MP, Slogan_comercial, Descripcion,
                   Record_Image, Latitud_MP, Longitud_MP
            FROM Mega_Proyectos
            WHERE Mega_proyecto_comercial = true
            LIMIT ${offset}, 200
          `
        };
        const { data: projects, more: hasMore } = await ZohoService.executeCoqlQuery(query);

        if (!projects || projects.length === 0) {
          logger.info(`No más mega proyectos en offset ${offset}`);
          break;
        }

        for (const project of projects) {
          totalProcessed++;
          const attributes = await ZohoService.getRelatedRecords(
            'Atributos_Mega_Proyecto',
            `Parent_Id.id:equals:${project.id}`
          );
          const attributeIds = attributes
            ? attributes.map(attr => attr.Atributo?.id).filter(id => id)
            : null;
          const gallery = project.Record_Image
            ? JSON.stringify(project.Record_Image.split(',').map(item => item.trim()).filter(Boolean))
            : JSON.stringify([]);

          try {
            await MegaModel.upsertMegaProject({
              id: project.id,
              name: project.Name,
              address: project.Direccion_MP,
              slogan: project.Slogan_comercial,
              description: project.Descripcion,
              attributes: attributeIds ? JSON.stringify(attributeIds) : null,
              gallery,
              latitude: parseFloat(project.Latitud_MP) || 0,
              longitude: parseFloat(project.Longitud_MP) || 0,
              is_public: false,
            });
            totalInserted++;
            logger.info(`Mega Proyecto ID ${project.id} procesado`);
          } catch (error) {
            logger.error(`Error al procesar mega proyecto ID ${project.id}: ${error.message}`);
            throw error;
          }
        }

        more = hasMore;
        offset += 200;
      }

      logger.info(`Sincronización completada: ${totalInserted}/${totalProcessed} mega proyectos procesados`);
      return { totalProcessed, totalInserted };
    } catch (error) {
      logger.error(`Error crítico en sincronización de mega proyectos: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MegaService;