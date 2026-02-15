export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const createLogger = (level: LogLevel = 'info') => {
  const shouldLog = (candidate: LogLevel) => {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(candidate) >= order.indexOf(level);
  };

  return {
    debug: (...args: unknown[]) => shouldLog('debug') && console.debug(...args),
    info: (...args: unknown[]) => shouldLog('info') && console.info(...args),
    warn: (...args: unknown[]) => shouldLog('warn') && console.warn(...args),
    error: (...args: unknown[]) => shouldLog('error') && console.error(...args)
  };
};
