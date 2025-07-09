const { pool } = require('../config/database');
const logger = require('../utils/logger'); // Asumiendo que tienes un logger

class AttributesModel {
  static async upsertAttribute(attrId, attrName) {
    const query = `
      INSERT INTO public."Project_Attributes" (id, "name")
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET
        "name" = EXCLUDED.name
      RETURNING *;
    `;
    const values = [String(attrId), attrName];

    try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      logger.error(`Error en upsertAttribute (ID: ${attrId}): ${error.message}`);
      return { success: false, error };
    }
  }
}

module.exports = AttributesModel;