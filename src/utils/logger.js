const winston = require('winston');
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
);
const logger = winston.createLogger({  
  level: 'info',// level: 'debug',   
  transports: [    
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ]
});

module.exports = logger;