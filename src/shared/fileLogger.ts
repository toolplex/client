import path from 'path';
import envPaths from 'env-paths';
import winston from 'winston';
import callsite from 'callsite';
import DailyRotateFile from 'winston-daily-rotate-file';

const paths = envPaths('ToolPlex', { suffix: '' });
export const logDir = path.join(paths.log);

function getCallingModule(): string {
  const stack = callsite();
  for (let i = 2; i < stack.length; i++) {
    const fileName = stack[i].getFileName();
    if (
      fileName &&
      !fileName.includes('node_modules') &&
      !fileName.includes('fileLogger') &&
      !fileName.includes('callsite')
    ) {
      return path.basename(fileName, path.extname(fileName));
    }
  }
  return 'unknown';
}

export class FileLogger {
  private static logger: winston.Logger;
  private static transport: DailyRotateFile;
  private static processName: string;

  static initialize(processName: string) {
    if (this.logger) return;
    this.processName = processName;

    const logLevel = process.env.LOG_LEVEL || 'info';

    this.transport = new DailyRotateFile({
      dirname: logDir,
      filename: `ToolPlex-${processName}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      zippedArchive: false,
      level: logLevel,
    });

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, module }) => {
          return `${timestamp} [${level.toUpperCase()}] ${module || 'unknown'} - ${message}`;
        })
      ),
      defaultMeta: {},
      transports: [this.transport],
    });
  }

  private static log(level: string, message: string) {
    const module = getCallingModule();
    this.logger.log({ level, message, module });
  }

  static info(message: string) {
    this.log('info', message);
  }

  static warn(message: string) {
    this.log('warn', message);
  }

  static error(message: string) {
    this.log('error', message);
  }

  static debug(message: string) {
    this.log('debug', message);
  }

  static async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.transport.on('finish', resolve);
      this.logger.end();
    });
  }
}
