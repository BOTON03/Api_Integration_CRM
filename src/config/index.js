require('dotenv').config();

const env = process.env.NODE_ENV || 'dev';

const config = {
  port: process.env.PORT || 6000,
  zoho: {
    clientId: process.env[`ZOHO_${env.toUpperCase()}_CLIENT_ID`],
    clientSecret: process.env[`ZOHO_${env.toUpperCase()}_CLIENT_SECRET`],
    refreshToken: process.env[`ZOHO_${env.toUpperCase()}_REFRESH_TOKEN`],
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    apiUrl: 'https://www.zohoapis.com/crm/v2',
  },
  db: {
    host: process.env[`PG_${env.toUpperCase()}_HOST`],
    database: process.env[`PG_${env.toUpperCase()}_DATABASE`],
    user: process.env[`PG_${env.toUpperCase()}_USER`],
    password: process.env[`PG_${env.toUpperCase()}_PASSWORD`],
    port: process.env[`PG_${env.toUpperCase()}_PORT`],
    ssl: process.env[`PG_${env.toUpperCase()}_SSL`] === 'true' ? { rejectUnauthorized: false } : false,
  },
  gcs: {
    bucketName: process.env[`GCS_${env.toUpperCase()}_BUCKET_NAME`],
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  } // Ajuste conexion GCP STORAGE [03/07/25]
}

module.exports = config;