const { Storage } = require('@google-cloud/storage');
const config = require('../config');
const logger = require('../utils/logger');

const storage = new Storage({
  keyFilename: config.gcs.credentials,
});

const bucketName = config.gcs.bucketName;
if (!bucketName) {
  throw new Error('El nombre del bucket de GCS no está configurado (GCS_BUCKET_NAME).');
}

async function getFilesAsPublicJson(prefix) {
  try {
    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    const urls = files
      .filter(file => !file.name.endsWith('/'))
      .map(file => ({
        // --- AQUÍ SE CONSTRUYE LA URL PÚBLICA ---
        url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`
      }));
    return urls;
  } catch (error) {
    logger.error(`[GCS Service] Error al obtener archivos como JSON público para "${prefix}":`, error);
    return [];
  }
}

module.exports = {
  getFilesAsPublicJson,
};