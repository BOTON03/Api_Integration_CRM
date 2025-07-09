const { pool } = require('../config/database');
const logger = require('../utils/logger');

class MegaModel {
  static async upsertMegaProject(project) {
    const query = `
      INSERT INTO public."Mega_Projects" (
        id, name, address, slogan, description, "attributes", gallery, latitude, longitude, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        slogan = EXCLUDED.slogan,
        description = EXCLUDED.description,
        "attributes" = EXCLUDED."attributes",
        gallery = EXCLUDED.gallery,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_public = EXCLUDED.is_public
      RETURNING *;
    `;
    const values = [
      project.id,
      project.name || '',
      project.address || '',
      project.slogan || '',
      project.description || '',
      project.attributes || null,
      project.gallery || JSON.stringify([]),
      project.latitude || 0,
      project.longitude || 0,
      project.is_public || false,
    ];

    try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      logger.error(`Error en upsertMegaProject (ID: ${project.id}): ${error.message}`);
      return { success: false, error };
    }
  }
}

module.exports = MegaModel;