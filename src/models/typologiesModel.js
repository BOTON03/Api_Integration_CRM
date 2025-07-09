const { pool } = require('../config/database');
const logger = require('../utils/logger');

class TypologiesModel {
  static async upsertTypology(typology) {
    const query = `
      INSERT INTO public."Typologies" (
        id, project_id, "name", description, price_from, price_up, rooms, bathrooms,
        built_area, private_area, plans, gallery
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        "name" = EXCLUDED.name,
        description = EXCLUDED.description,
        price_from = EXCLUDED.price_from,
        price_up = EXCLUDED.price_up,
        rooms = EXCLUDED.rooms,
        bathrooms = EXCLUDED.bathrooms,
        built_area = EXCLUDED.built_area,
        private_area = EXCLUDED.private_area,
        plans = EXCLUDED.plans,
        gallery = EXCLUDED.gallery
      RETURNING *;
    `;
    const values = [
      typology.id,
      typology.project_id,
      typology.name || '',
      typology.description || '',
      typology.price_from || 0,
      typology.price_up || 0,
      typology.rooms || 0,
      typology.bathrooms || 0,
      typology.built_area || 0,
      typology.private_area || 0,
      typology.plans || null,
      typology.gallery || null,
    ];

    try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      logger.error(`Error en upsertTypology (ID: ${typology.id}, Proyecto ID: ${typology.project_id}): ${error.message}`);
      return { success: false, error };
    }
  }
}

module.exports = TypologiesModel;