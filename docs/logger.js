// Sets up logging functions.
export function createLogger(prefix) {
    const log = (...args) => console.log(`${prefix}:`, ...args);
    const err = (...args) => console.error(`${prefix}:`, ...args);
    const startTimer = (marker) => {
        const t = performance.now();
        log(`${marker}...`);
        return () => log(`${marker} took:`, Math.round(performance.now() - t), "ms");
    };
    return {
        log,
        err,
        startTimer,
    };
}
