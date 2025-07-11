// models/typologiesModel.js

const { pool } = require('../config/database');
const logger = require('../utils/logger');

class TypologiesModel {
  static async upsertTypology(typology) {    
    const query = `
      INSERT INTO public."Typologies" (
        id, project_id, "name", description, price_from, price_up, rooms, bathrooms,
        built_area, private_area, plans, gallery,
        min_separation, min_deposit, delivery_time, available_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
        gallery = EXCLUDED.gallery,
        -- AJUSTE: Se añaden los campos a la sección de actualización
        min_separation = EXCLUDED.min_separation,
        min_deposit = EXCLUDED.min_deposit,
        delivery_time = EXCLUDED.delivery_time,
        available_count = EXCLUDED.available_count
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
      // Nuevos valores
      typology.min_separation || null,
      typology.min_deposit || null,
      typology.delivery_time || null,
      typology.available_count || null
    ];

    try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      logger.error(`Error en upsertTypology (ID: ${typology.id}, Proyecto ID: ${typology.project_id}): ${error.message}`);
      return { success: false, error };
    }
  }
  
  static async truncate() {   
    const query = 'TRUNCATE TABLE public."Typologies" RESTART IDENTITY CASCADE;';    
    try {
      await pool.query(query);
      logger.info('Tabla "Typologies" truncada exitosamente.');
    } catch (error) {
      logger.error(`Error fatal al truncar la tabla "Typologies": ${error.message}`);     
      throw new Error('No se pudo truncar la tabla de tipologías.');
    }
  }
}

module.exports = TypologiesModel;