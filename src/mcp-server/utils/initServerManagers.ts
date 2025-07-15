// utils/initServerManagers.ts
import { StdioServerManagerClient } from '../../shared/stdioServerManagerClient.js';
import { InitializeResult, InitializeResultSchema } from '../../shared/serverManagerTypes.js';
import { FileLogger } from '../../shared/fileLogger.js';

const logger = FileLogger;

export async function initServerManagersOnly(
  serverManagerClients: Record<string, StdioServerManagerClient>
): Promise<{ succeeded: InitializeResult['succeeded']; failures: InitializeResult['failures'] }> {
  await logger.info('Pre-warming server manager clients');

  const initPromises = Object.entries(serverManagerClients).map(async ([runtime, client]) => {
    try {
      const response = await client.sendRequest('initialize', {});
      if ('error' in response) throw new Error(response.error.message);
      const parsed = InitializeResultSchema.safeParse(response);
      if (!parsed.success) throw new Error(parsed.error.message);
      return { runtime, result: parsed.data };
    } catch (err) {
      await logger.error(`Warmup error for ${runtime}: ${err}`);
      return { runtime, result: { succeeded: [], failures: {} } };
    }
  });

  const results = await Promise.all(initPromises);

  const allSucceeded: InitializeResult['succeeded'] = [];
  const allFailures: InitializeResult['failures'] = {};
  for (const { runtime, result } of results) {
    allSucceeded.push(...(result.succeeded || []));
    Object.assign(allFailures, result.failures || {});
    await logger.debug(`Warmup result for ${runtime}: ${JSON.stringify(result)}`);
  }

  await logger.debug(
    `Warmup completed: ${allSucceeded.length} successes, ${Object.keys(allFailures).length} failures`
  );

  return { succeeded: allSucceeded, failures: allFailures };
}
