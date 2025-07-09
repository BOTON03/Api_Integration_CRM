const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function upsertProject(projectData) {
  const query = `
    INSERT INTO public."Projects" (
        hc, name, slogan, address, small_description, long_description, sic,
        salary_minimum_count, discount_description, price_from_general,
        price_up_general, "type", mega_project_id, status, highlighted, built_area,
        private_area, rooms, bathrooms, latitude, longitude, is_public, attributes, city
        
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
    )
    ON CONFLICT (hc) DO UPDATE SET
        name = EXCLUDED.name, slogan = EXCLUDED.slogan, address = EXCLUDED.address,
        small_description = EXCLUDED.small_description, long_description = EXCLUDED.long_description,
        sic = EXCLUDED.sic, salary_minimum_count = EXCLUDED.salary_minimum_count, discount_description = EXCLUDED.discount_description,
        price_from_general = EXCLUDED.price_from_general, price_up_general = EXCLUDED.price_up_general,
        "type" = EXCLUDED.type, mega_project_id = EXCLUDED.mega_project_id, status = EXCLUDED.status,
        highlighted = EXCLUDED.highlighted, built_area = EXCLUDED.built_area, private_area = EXCLUDED.private_area,
        rooms = EXCLUDED.rooms, bathrooms = EXCLUDED.bathrooms, latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude, is_public = EXCLUDED.is_public, attributes = EXCLUDED.attributes,
        city = EXCLUDED.city;
  `;
  
  // Se construye el array de valores explícitamente para garantizar el orden correcto. ¡Esto es una excelente práctica!
  const values = [
    projectData.hc, projectData.name, projectData.slogan, projectData.address,
    projectData.small_description, projectData.long_description, projectData.sic,
    projectData.salary_minimum_count, projectData.discount_description,
    projectData.price_from_general, projectData.price_up_general, projectData.type,
    projectData.mega_project_id, projectData.status, projectData.highlighted,
    projectData.built_area, projectData.private_area, projectData.rooms,
    projectData.bathrooms, projectData.latitude, projectData.longitude,
    projectData.is_public, projectData.attributes, projectData.city
  ];

  try {
    // La consulta se ejecuta. Si hay un error, el bloque catch lo manejará.
    await pool.query(query, values);
    return { success: true };
  } catch (error) {
    logger.error(`[Projects Model] Error en upsertProject para HC ${projectData.hc}:`, error);
    return { success: false, error };
  }
}

async function updateProjectFiles(projectId, galleryUrls, urbanPlansUrls) {
  const query = `
    UPDATE public."Projects"
    SET
      gallery = $1,
      urban_plans = $2
    WHERE hc = $3;
  `;
  // Convierte los arrays de URLs a JSON para la BD, manejando el caso de arrays vacíos
  const galleryUrlsJson = galleryUrls.length > 0 ? JSON.stringify(galleryUrls) : null;
  const urbanPlansUrlsJson = urbanPlansUrls.length > 0 ? JSON.stringify(urbanPlansUrls) : null;

  try {
    const result = await pool.query(query, [galleryUrlsJson, urbanPlansUrlsJson, projectId]);
    if (result.rowCount === 0) {
      logger.warn(`[Projects Model] Se intentó actualizar URLs para el proyecto HC ${projectId}, pero no se encontró.`);
    }
    return { success: true };
  } catch (error) {
    logger.error(`[Projects Model] Error al actualizar URLs para el proyecto HC ${projectId}:`, error);
    return { success: false, error };
  }
}


module.exports = {
  upsertProject,
  updateProjectFiles,
};