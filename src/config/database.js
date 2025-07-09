const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  host: config.db.host,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  port: config.db.port,
  ssl: config.db.ssl,
});

module.exports = {
  pool,
  closePool: async () => {
    await pool.end();
  },
};
