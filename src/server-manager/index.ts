import { ServerManagerProtocol } from './stdioServer.js';
import { FileLogger } from '../shared/fileLogger.js';

FileLogger.initialize('server-manager');

const protocol = new ServerManagerProtocol();
protocol.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
