const { pool } = require('../config/database');
const logger = require('../utils/logger');

class CitiesModel {
  static async upsertCity(cityId, cityName, isPublic = true) {
    const query = `
      INSERT INTO public."Cities" (id, "name", is_public)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        "name" = EXCLUDED."name",
        is_public = EXCLUDED.is_public
      RETURNING *;
    `;
    const values = [cityId, cityName, isPublic];

    try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      logger.error(`Error en upsertCity (ID: ${cityId}): ${error.message}`);
      return { success: false, error };
    }
  }
}

module.exports = CitiesModel;