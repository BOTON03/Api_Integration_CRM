const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

app.listen(config.port, () => {
  logger.info(`[${new Date().toLocaleString()}] Servidor activo en puerto ${config.port}`);
});