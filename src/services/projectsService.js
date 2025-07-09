const ZohoService = require('./zohoService');
const ProjectsModel = require('../models/projectsModel');
const TypologiesModel = require('../models/typologiesModel');
const logger = require('../utils/logger');
const gcsService = require('./gcsService');

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
      logger.info('🚀 Iniciando sincronización COMPLETA: Proyectos + Tipologías');
      
      let offset = 0, more = true;
      const summary = { 
        totalProcessed: 0, 
        totalInserted: 0, 
        totalUpdatedWithFiles: 0, 
        failedProjects: [],
        typologies: { totalProcessed: 0, totalInserted: 0, failed: [] }
      };

      while (more) {
        // 1. Obtener proyectos de Zoho
        const coqlQueryObject = {
          select_query: `
            SELECT
              id, Name, Slogan, Direccion, Descripcion_corta, Descripcion_larga,
              SIG, Sala_de_ventas.Name, Cantidad_SMMLV, Descripcion_descuento,
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
            // 2. Obtener atributos del proyecto
            const attributeIdsArray = await this.getProjectAttributes(projectId);

            // 3. Mapear y guardar datos principales del proyecto
            const statusMap = {
              'sobre planos': '1000000000000000001',
              'en construccion': '1000000000000000002',
              'lanzamiento': '1000000000000000003',
              'entrega inmediata': '1000000000000000004'
            };
            let statusForDb = null;
            const statusFromZoho = project.Estado;
            if (statusFromZoho && typeof statusFromZoho === 'string') {
              const normalizedStatus = statusFromZoho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const statusId = statusMap[normalizedStatus];
              if (statusId) {
                statusForDb = JSON.stringify([statusId]);
              }
            }

            const projectData = {
              hc: projectId,
              name: project.Name || '',
              slogan: project.Slogan || '',
              address: project.Direccion || '',
              small_description: project.Descripcion_corta || '',
              long_description: project.Descripcion_larga || '',
              sic: project.SIG || '',
              salary_minimum_count: parseInt(project.Cantidad_SMMLV, 10) || 0,
              discount_description: project.Descripcion_descuento || '',
              price_from_general: parseFloat(project.Precios_desde) || 0,
              price_up_general: parseFloat(project.Precios_hasta) || 0,
              type: project.Tipo_de_proyecto || '',
              mega_project_id: project['Mega_Proyecto.id'] || null,
              status: statusForDb,
              highlighted: project.Proyecto_destacado || false,
              built_area: parseFloat(project.Area_construida_desde) || 0,
              private_area: parseFloat(project.Area_construida_hasta) || 0,
              rooms: Array.isArray(project.Habitaciones)
                ? Math.max(0, ...project.Habitaciones.map(n => parseInt(n, 10)).filter(Number.isFinite))
                : parseInt(project.Habitaciones, 10) || 0,
              bathrooms: Array.isArray(project['Ba_os'])
                ? Math.max(0, ...project['Ba_os'].map(n => parseInt(n, 10)).filter(Number.isFinite))
                : parseInt(project['Ba_os'], 10) || 0,
              latitude: parseFloat(project.Latitud) || 0,
              longitude: parseFloat(project.Longitud) || 0,
              is_public: false,
              attributes: attributeIdsArray ? JSON.stringify(attributeIdsArray) : null,
              city: project['Ciudad.id'] || null
            };

            await ProjectsModel.upsertProject(projectData);
            logger.info(`[Paso 1/3] Proyecto HC ${projectId} (${project.Name}): Datos de Zoho insertados/actualizados.`);
            summary.totalInserted++;

            // 4. Obtener URLs públicas para los archivos del PROYECTO
            logger.info(`[Paso 2/3] Proyecto HC ${projectId} (${project.Name}): Buscando archivos en GCS (gallery: projects/${projectId}/gallery/, urban_plans: projects/${projectId}/urban_plans/)...`);
            const [galleryFiles, urbanPlansFiles] = await Promise.all([
              gcsService.getFilesAsPublicJson(`projects/${projectId}/gallery/`).catch(err => {
                logger.error(`❌ Error al obtener archivos de galería para proyecto ${projectId}: ${err.message}`);
                return [];
              }),
              gcsService.getFilesAsPublicJson(`projects/${projectId}/urban_plans/`).catch(err => {
                logger.error(`❌ Error al obtener archivos de planos para proyecto ${projectId}: ${err.message}`);
                return [];
              })
            ]);
            const galleryUrls = galleryFiles
              .filter(file => /\.(jpg|jpeg|png)$/i.test(file.name))
              .map(file => file.url);
            const urbanPlansUrls = urbanPlansFiles
              .filter(file => /\.(jpg|jpeg|png)$/i.test(file.name))
              .map(file => file.url);

            if (galleryUrls.length > 0 || urbanPlansUrls.length > 0) {
              await ProjectsModel.updateProjectFiles(projectId, galleryUrls, urbanPlansUrls);
              logger.info(`[Paso 2/3] Proyecto HC ${projectId} (${project.Name}): Actualizado con ${galleryUrls.length} URLs de galería y ${urbanPlansUrls.length} de planos.`);
              summary.totalUpdatedWithFiles++;
            } else {
              logger.info(`[Paso 2/3] Proyecto HC ${projectId} (${project.Name}): No se encontraron archivos en GCS (gallery: projects/${projectId}/gallery/, urban_plans: projects/${projectId}/urban_plans/).`);
            }

            // 5. Procesar las tipologías (sin archivos)
            logger.info(`[Paso 3/3] Proyecto HC ${projectId} (${project.Name}): Procesando tipologías...`);
            const typologies = await ZohoService.getRelatedRecords('Tipologias', `Parent_Id.id:equals:${projectId}`);
            if (typologies && typologies.length > 0) {
              logger.info(`ℹ️ Obtenidos ${typologies.length} registros de Tipologías para proyecto ${projectId} (${project.Name}).`);
              for (const t of typologies) {
                if (!t.id) {
                  logger.warn(`⚠️ Tipología sin ID encontrada para el proyecto ${projectId} (${project.Name}). Omitiendo.`);
                  summary.typologies.failed.push({ id: null, projectId, name: 'Desconocida', reason: 'Tipología sin ID' });
                  continue;
                }

                summary.typologies.totalProcessed++;
                await TypologiesModel.upsertTypology({
                  id: t.id,
                  project_id: projectId,
                  name: t.Nombre || '',
                  description: t.Descripci_n || '',
                  price_from: parseFloat(t.Precio_desde) || 0,
                  price_up: 0,
                  rooms: parseInt(t.Habitaciones, 10) || 0,
                  bathrooms: parseInt(t.Ba_os, 10) || 0,
                  built_area: parseFloat(t.Area_construida) || 0,
                  private_area: parseFloat(t.Area_privada) || 0,
                  plans: null,
                  gallery: null
                });
                summary.typologies.totalInserted++;
                logger.info(`  -> Tipología ${t.id} (${t.Nombre || 'Sin nombre'}) procesada.`);
              }
              logger.info(`[Paso 3/3] Proyecto HC ${projectId} (${project.Name}): Procesadas ${typologies.length} tipologías.`);
            } else {
              logger.info(`[Paso 3/3] Proyecto HC ${projectId} (${project.Name}): Sin tipologías para procesar.`);
            }
          } catch (error) {
            logger.warn(`🚨 Proyecto HC ${projectId} (${project.Name || 'Sin nombre'}): Falló el procesamiento completo. Razón: ${error.message}`);
            summary.failedProjects.push({ hc: projectId, name: project.Name || 'Sin nombre', reason: error.message });
          }
        }
        more = hasMore;
        offset += 200;
      }

      logger.info('✅ Sincronización completa finalizada.', summary);
      return {
        message: 'Sincronización completa',
        results: {
          
          projects: {
            totalProcessed: summary.totalProcessed,
            totalInserted: summary.totalInserted,
            totalUpdatedWithFiles: summary.totalUpdatedWithFiles,
            failedProjects: summary.failedProjects
          },
          typologies: {
            totalProcessed: summary.typologies.totalProcessed,
            totalInserted: summary.typologies.totalInserted,
            failed: summary.typologies.failed
          }
        }
      };
    } catch (error) {
      logger.error(`🚨 Error crítico durante la sincronización: ${error.message}`, { stack: error.stack });
      throw error;
    } finally {
      logger.info('🔌 Finalizando recursos...');
    }
  }
}

module.exports = ProjectsService;