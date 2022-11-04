export type Logger = {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export function isLogger(obj: any): obj is Logger {
  return (
    'debug' in obj &&
    typeof obj.debug === 'function' &&
    'info' in obj &&
    typeof obj.info === 'function' &&
    'warn' in obj &&
    typeof obj.warn === 'function' &&
    'error' in obj &&
    typeof obj.error === 'function'
  );
}
