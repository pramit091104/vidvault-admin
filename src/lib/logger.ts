import { format } from 'date-fns';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export const logger = {
  info: (message: string, data?: any) => log(LogLevel.INFO, message, data),
  warn: (message: string, data?: any) => log(LogLevel.WARN, message, data),
  error: (message: string, error?: any) => log(LogLevel.ERROR, message, error),
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      log(LogLevel.DEBUG, message, data);
    }
  }
};

function log(level: LogLevel, message: string, data?: any) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const logEntry = { timestamp, level, message };
  
  if (data) {
    if (data instanceof Error) {
      logEntry['error'] = {
        message: data.message,
        stack: data.stack,
        ...data
      };
    } else {
      logEntry['data'] = data;
    }
  }

  const logString = JSON.stringify(logEntry);
  
  // Log to appropriate stream based on level
  switch (level) {
    case LogLevel.ERROR:
      console.error(logString);
      break;
    case LogLevel.WARN:
      console.warn(logString);
      break;
    default:
      console.log(logString);
  }

  // In a production environment, you might want to send logs to a logging service
  // sendToLoggingService(logEntry);
}
