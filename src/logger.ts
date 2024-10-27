// Sets up logging functions.
export function createLogger(prefix: string) {
  const log = (...args: Array<any>) => console.log(`${prefix}:`, ...args);
  const err = (...args: Array<any>) => console.error(`${prefix}:`, ...args);
  const startTimer = (marker: string) => {
    const t = performance.now();
    log(`${marker}...`);
    return () =>
      log(`${marker} took:`, Math.round(performance.now() - t), "ms");
  };

  return {
    log,
    err,
    startTimer,
  };
}
