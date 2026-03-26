/**
 * Create a scoped logger for an edge function.
 * Prefixes all messages with the function name for easier log filtering.
 */
export function createLogger(functionName: string) {
  const prefix = `[${functionName}]`;
  return {
    info: (...args: any[]) => console.log(prefix, ...args),
    warn: (...args: any[]) => console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
    step: (step: string, details?: any) => {
      const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
      console.log(`${prefix} ${step}${detailsStr}`);
    },
  };
}
