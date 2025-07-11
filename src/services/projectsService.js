const ZohoService = require('./zohoService');
const ProjectsModel = require('../models/projectsModel');
const TypologiesModel = require('../models/typologiesModel');
const logger = require('../utils/logger');
const gcsService = require('./gcsService');
const { parse } = require('dotenv');

class ProjectsService {    
  static async getProjectAttributes(parentId) {
      try {
        const response = await ZohoService.getRelatedRecords('Atributos', `Parent_Id.id:equals:${parentId}`);
        if (!response?.data) {
          logger.info(`ℹ️ No se encontraron atributos para el proyecto ${parentId}`);
          return null;
        }
        const attributeIds = response.data.map(attr => attr.Atributo?.id).filter(Boolean);
        logger.info(`✅ IDs de atributos recuperados para proyecto ${parentId}: ${attributeIds.length}`);
        return attributeIds;
      } catch (error) {
        logger.error(`❌ Error al obtener atributos para proyecto ${parentId}: ${error.message}`);
        throw error;
      }
    }

  static async syncProjects() {
    try {
      logger.info('🚀 Iniciando sincronización COMPLETA: Proyectos + Tipologías + Archivos GCS'); 
      await TypologiesModel.truncate();
      let offset = 0, more = true;
      const summary = { 
        totalProcessed: 0, 
        totalInsertedOrUpdated: 0, 
        failedProjects: [],
        typologies: { totalProcessed: 0, totalInsertedOrUpdated: 0, failed: [] }
      };

      while (more) {       
        const coqlQueryObject = {
          select_query: `
            SELECT
              id, Name, Slogan, Direccion, Descripcion_corta, Descripcion_larga,
              SIG, Cantidad_SMMLV, Descripcion_descuento,
              Precios_desde, Precios_hasta, Tipo_de_proyecto, Mega_Proyecto.id,
              Estado, Proyecto_destacado, Area_construida_desde, Area_construida_hasta,
              Habitaciones, Ba_os, Latitud, Longitud, Ciudad.id
            FROM Proyectos_Comerciales
            WHERE id is not null                
            LIMIT ${offset}, 200
          `
        };
        const { data: projects, more: hasMore } = await ZohoService.executeCoqlQuery(coqlQueryObject);
        if (!projects || projects.length === 0) {
          logger.info('ℹ️ No se encontraron más proyectos para procesar.');
          break;
        }

        for (const project of projects) {
          summary.totalProcessed++;
          const projectId = project.id;
          if (!projectId) {
            logger.warn(`⚠️ Proyecto inválido o sin ID en lote de Zoho. Omitiendo.`);
            summary.failedProjects.push({ hc: null, name: 'Desconocido', reason: 'Proyecto sin ID' });
            continue;
          }

          try {            
            const attributeIdsArray = await this.getProjectAttributes(projectId);
            const statusMap = {
              'sobre planos': '1000000000000000001',
              'en construccion': '1000000000000000002',
              'lanzamiento': '1000000000000000003',
              'entrega inmediata': '1000000000000000004'
            };
            const normalizedStatus = project.Estado?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const statusId = statusMap[normalizedStatus];
            const statusForDb = statusId ? JSON.stringify([statusId]) : null;

            const projectData = {
              hc: projectId, name: project.Name || '', slogan: project.Slogan || '',
              address: project.Direccion || '', small_description: project.Descripcion_corta || '',
              long_description: project.Descripcion_larga || '', sic: project.SIG || '',
              salary_minimum_count: parseInt(project.Cantidad_SMMLV, 10) || 0,
              discount_description: project.Descripcion_descuento || '',
              price_from_general: parseFloat(project.Precios_desde) || 0,
              price_up_general: parseFloat(project.Precios_hasta) || 0,
              type: project.Tipo_de_proyecto || '', mega_project_id: project['Mega_Proyecto.id'] || null,
              status: statusForDb, highlighted: project.Proyecto_destacado || false,
              built_area: parseFloat(project.Area_construida_desde) || 0,
              private_area: parseFloat(project.Area_construida_hasta) || 0,
              rooms: Array.isArray(project.Habitaciones) ? Math.max(0, ...project.Habitaciones.map(n => parseInt(n, 10)).filter(Number.isFinite)) : parseInt(project.Habitaciones, 10) || 0,
              bathrooms: Array.isArray(project['Ba_os']) ? Math.max(0, ...project['Ba_os'].map(n => parseInt(n, 10)).filter(Number.isFinite)) : parseInt(project['Ba_os'], 10) || 0,
              latitude: parseFloat(project.Latitud) || 0, longitude: parseFloat(project.Longitud) || 0,
              is_public: false, attributes: attributeIdsArray ? JSON.stringify(attributeIdsArray) : null,
              city: project['Ciudad.id'] || null
            };

            await ProjectsModel.upsertProject(projectData);
            logger.info(`[Paso 1/3] Proyecto HC ${projectId} (${project.Name}): Datos de Zoho insertados/actualizados.`);
            summary.totalInsertedOrUpdated++;           
            logger.info(`[Paso 2/3] Proyecto HC ${projectId} (${project.Name}): Procesando tipologías...`);            
            
            const fieldsToGet = [
                'id', 'Nombre', 'Descripci_n', 'Precio_desde', 'Habitaciones', 
                'Ba_os', 'Area_construida', 'Area_privada', 'Separacion', 
                'Cuota_inicial1', 'Plazo_en_meses'
            ];
            const typologiesFromZoho = await ZohoService.getRelatedRecords('Tipologias', `Parent_Id.id:equals:${projectId}`, fieldsToGet);
            
            if (typologiesFromZoho && typologiesFromZoho.length > 0) {
              logger.info(`ℹ️ Obtenidos ${typologiesFromZoho.length} registros de Tipologías para proyecto ${projectId}.`);
              for (const t of typologiesFromZoho) {
                summary.typologies.totalProcessed++;
                if (!t.id) {
                  logger.warn(`⚠️ Tipología sin ID encontrada para el proyecto ${projectId}. Omitiendo.`);
                  summary.typologies.failed.push({ id: null, projectId, reason: 'Tipología sin ID' });
                  continue;
                }

                const typologyId = t.id;
                const [typologyGalleryFiles, typologyPlansFiles] = await Promise.all([
                  gcsService.getFilesAsPublicJson(`projects/${projectId}/typologies/${typologyId}/gallery/`).catch(() => []),
                  gcsService.getFilesAsPublicJson(`projects/${projectId}/typologies/${typologyId}/plans/`).catch(() => [])
                ]);
                
                await TypologiesModel.upsertTypology({
                  id: typologyId,
                  project_id: projectId,
                  name: t.Nombre || '',
                  description: t.Descripci_n || '',
                  price_from: parseFloat(t.Precio_desde) || 0,
                  price_up: 0,
                  rooms: parseInt(t.Habitaciones, 10) || 0,
                  bathrooms: parseInt(t.Ba_os, 10) || 0,
                  built_area: parseFloat(t.Area_construida) || 0,
                  private_area: parseFloat(t.Area_privada) || 0,
                  plans: typologyPlansFiles.length > 0 ? JSON.stringify(typologyPlansFiles.map(f => f.url)) : null,
                  gallery: typologyGalleryFiles.length > 0 ? JSON.stringify(typologyGalleryFiles.map(f => f.url)) : null,
                  // MAPEANDO LOS NUEVOS CAMPOS
                  min_separation: parseInt(t.Separacion, 10) || null,
                  min_deposit: parseInt(t.Cuota_inicial1, 10) || null,
                  delivery_time: parseInt(t.Plazo_en_meses, 10) || null,
                  available_count: parseInt(t.Und_Disponibles, 10) || null
                });
                summary.typologies.totalInsertedOrUpdated++;
                logger.info(`  -> Tipología ${typologyId} (${t.Nombre || 'Sin nombre'}) procesada.`);
              }
            } else {
              logger.info(`[Paso 2/3] Proyecto HC ${projectId} (${project.Name}): Sin tipologías para procesar.`);
            }
            
            logger.info(`[Paso 3/3] Proyecto HC ${projectId} (${project.Name}): Sincronizando archivos del proyecto...`);
            const [projectGalleryUrls, projectUrbanPlansUrls] = await Promise.all([
              gcsService.getFilesAsPublicJson(`projects/${projectId}/gallery/`).then(files => files.map(f => f.url)).catch(() => []),
              gcsService.getFilesAsPublicJson(`projects/${projectId}/urban_plans/`).then(files => files.map(f => f.url)).catch(() => [])
            ]);            
            
            const deliveryTime = typologiesFromZoho?.map(t => parseInt(t['Plazo_en_meses'], 10)).filter(Number.isFinite).reduce((min, current) => (min === null ? current : Math.min(min, current)), null) ?? null;
            const deposit = typologiesFromZoho?.map(t => parseInt(t['Cuota_inicial1'], 10)).filter(Number.isFinite).reduce((min, current) => (min === null ? current : Math.min(min, current)), null) ?? null;
            
            await ProjectsModel.updateProjectFilesAndTypologyData(projectId, projectGalleryUrls, projectUrbanPlansUrls, deliveryTime, deposit);
            logger.info(`[Paso 3/3] Proyecto HC ${projectId} actualizado con URLs y datos agregados.`);

          } catch (error) {
            logger.error(`🚨 Proyecto HC ${projectId} (${project.Name || 'Sin nombre'}): Falló el procesamiento completo. Razón: ${error.message}`);
            summary.failedProjects.push({ hc: projectId, name: project.Name || 'Sin nombre', reason: error.message });
          }
        }
        more = hasMore;
        offset += 200;
      }

      logger.info('✅ Sincronización completa.', summary);
      return { message: 'Sincronización completa', results: summary };

    } catch (error) {
      logger.error(`🚨 Error crítico durante la sincronización: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
}

module.exports = ProjectsService;