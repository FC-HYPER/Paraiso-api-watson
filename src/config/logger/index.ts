export const loggerConfig = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
};
