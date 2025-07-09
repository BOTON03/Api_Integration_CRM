// src/services/zohoService.js

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

let accessToken = null;
let tokenExpiresAt = 0;

class ZohoService {
  
  static async getAccessToken() {
    // Valida token expira 
    if (accessToken && Date.now() < tokenExpiresAt - 60000) { // Margen de 60s
      logger.info('Usando token de Zoho desde caché');
      return accessToken;
    }

    try {
      logger.info('Token de Zoho expirado o no existe. Solicitando uno nuevo...');
      const response = await axios.post(config.zoho.tokenUrl, null, {
        params: {
          refresh_token: config.zoho.refreshToken,
          client_id: config.zoho.clientId,
          client_secret: config.zoho.clientSecret,
          grant_type: 'refresh_token',
        },
      });

      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in; // Generalmente 3600

      if (!newAccessToken) {
        throw new Error('No se recibió el token de acceso de Zoho');
      }

      // Guardamos el nuevo token y calculamos su tiempo de expiración
      accessToken = newAccessToken;
      tokenExpiresAt = Date.now() + expiresIn * 1000;

      logger.info('Nuevo token de Zoho obtenido y guardado en caché');
      return accessToken;
    } catch (error) {
      if (error.response?.data) {
        logger.error(`Error de API de Zoho al obtener token: ${JSON.stringify(error.response.data)}`);
      }
      logger.error(`Error al obtener token de Zoho: ${error.message}`);
      throw error;
    }
  }

  static async executeCoqlQuery(query) {
    try {
      const token = await this.getAccessToken(); // Ahora es ultra-rápido después de la primera vez
      const response = await axios.post(`${config.zoho.apiUrl}/coql`, query, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = response.data.data || [];
      const info = response.data.info || {};
      logger.info(`Obtenidos ${data.length} registros desde Zoho vía COQL`);
      return { data, more: info.more_records === true, count: info.count || 0 };
    } catch (error) {
      logger.error(`Error al ejecutar consulta COQL: ${error.message}`);
      throw error;
    }
  }

  static async getRelatedRecords(module, criteria) {
    try {
      const token = await this.getAccessToken(); 
      const response = await axios.get(
        `${config.zoho.apiUrl}/${module}/search?criteria=${encodeURIComponent(criteria)}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
          validateStatus: status => [200, 204].includes(status),
        }
      );
      if (response.status === 204 || !response.data?.data) {
        logger.info(`Sin datos en ${module} para la criteria: ${criteria}`);
        return []; // Mejor devolver array vacío que null para evitar errores
      }
      logger.info(`Obtenidos ${response.data.data.length} registros de ${module}`);
      return response.data.data;
    } catch (error) {
      logger.error(`Error al obtener registros de ${module}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ZohoService;