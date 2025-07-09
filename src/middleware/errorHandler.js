const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  if (err.response?.data) {
    logger.error(`Respuesta de API: ${JSON.stringify(err.response.data)}`);
  }
  res.status(500).json({ error: 'Error interno del servidor' });
};