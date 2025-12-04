require('dotenv').config();

const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  database: {
    path: process.env.DATABASE_PATH || './data/workspaces.db'
  },
  sync: {
    schedule: process.env.SYNC_SCHEDULE || '0 */6 * * *' // Every 6 hours
  }
};

module.exports = config;
