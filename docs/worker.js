self.onerror = (error) => {
    console.error("worker error:", error);
    throw error;
};
import init, { set_font, set_image, draw_image, } from "./wasm/pkg/lofi_stripes.js";
import { createLogger } from "./logger.js";
const { log, startTimer } = createLogger("js-worker");
// Can't run here as it takes time and worker misses the ping message.
// await init();
let _wasmInitPromise = null;
function maybeInitWasm() {
    if (_wasmInitPromise == null) {
        const stopInitTimer = startTimer("init wasm");
        _wasmInitPromise = init().then(stopInitTimer);
    }
    return _wasmInitPromise;
}
self.onmessage = async (event) => {
    try {
        const { command } = event.data;
        log(`received command:${command}`);
        await maybeInitWasm();
        switch (command) {
            case "ping":
                log("ping-pong");
                self.postMessage({
                    command,
                    error: null,
                });
                break;
            case "set_font":
                self.postMessage({
                    command,
                    error: null,
                    data: commandSetFont(event.data.data),
                });
                break;
            case "set_image":
                self.postMessage({
                    command,
                    error: null,
                    data: commandSetImage(event.data.data),
                });
                break;
            case "draw_image":
                const data = commandDrawImage(event.data.data);
                self.postMessage({
                    command,
                    error: null,
                    data,
                }, { transfer: [data.buffer] });
                break;
            default:
                throw new Error(`Unsupported command: ${command}`);
        }
    }
    catch (e) {
        self.postMessage({
            command: event.data.command,
            error: e,
        });
    }
};
function commandSetFont({ arrayBuffer }) {
    const stopTimer = startTimer("setting font");
    set_font(new Uint8Array(arrayBuffer));
    stopTimer();
}
function commandSetImage({ arrayBuffer }) {
    const stopTimer = startTimer("setting image");
    set_image(new Uint8Array(arrayBuffer));
    stopTimer();
}
function commandDrawImage({ params, }) {
    const stopTimer = startTimer("drawing image");
    const resultImageBytes = draw_image(params.textTop, params.textBottom, params.fontSize, params.stripeCount, params.stripeHeightPercent, params.rotateAngle);
    stopTimer();
    return resultImageBytes;
}
