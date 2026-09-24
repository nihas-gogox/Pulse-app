import { captureException, captureMessage } from './crashReporter';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const CURRENT_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel) {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[CURRENT_LEVEL];
}

function format(message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (context && Object.keys(context).length > 0) {
    return `[${timestamp}] ${message} | ${JSON.stringify(context)}`;
  }

  return `[${timestamp}] ${message}`;
}

/** Pull the first Error out of the context bag, if present, for crash reporting. */
function extractError(context?: Record<string, unknown>): Error | undefined {
  if (!context) return undefined;
  for (const value of Object.values(context)) {
    if (value instanceof Error) return value;
  }
  return undefined;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (!shouldLog('debug')) return;
     
    console.debug(format(message, context));
  },
  info: (message: string, context?: Record<string, unknown>) => {
    if (!shouldLog('info')) return;
     
    console.info(format(message, context));
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (!shouldLog('warn')) return;
     
    console.warn(format(message, context));
    captureMessage(message, 'warning', context);
  },
  error: (message: string, context?: Record<string, unknown>) => {
    if (!shouldLog('error')) return;
     
    console.error(format(message, context));
    const err = extractError(context);
    if (err) {
      captureException(err, { message, ...context });
    } else {
      captureMessage(message, 'error', context);
    }
  },
};

