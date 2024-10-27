import {createLogger} from "./logger.js";

import type {
  ParamsType,
  WorkerRequestType,
  WorkerResponseSuccessType,
  WorkerResponseType,
} from "./types.d.ts";

// Rust worker.
// TODO: cache in prod.
const worker = new Worker(`./worker.js?v=${+Date.now()}`, {type: "module"});

const CANVAS_PADDING = 20;
const URL_FONT = "data/font-raleway-dots-regular.ttf";
const URL_DEMO_IMAGES = [
  "data/hw1fog.jpeg",
  "data/hw101south.jpeg",
  "data/hw101north.jpeg",
];
const URL_RANDOM_DEMO_IMAGE =
  URL_DEMO_IMAGES[Math.floor(Math.random() * URL_DEMO_IMAGES.length)];

// Stores the last rendered image blob.
let lastImageBlob: Blob | null = null;

// Logging.
// TODO: show errors on UI.
const {log, err, startTimer} = createLogger("js-main");

// Canvas.
const CANVAS = document.getElementById("image-canvas") as HTMLCanvasElement;

// Loading mask.
const LOADING_MASK = document.getElementById("loading-mask") as HTMLDivElement;
const LOADING_MASK_TEXT = document.getElementById(
  "loading-mask-text",
) as HTMLSpanElement;

// Inputs.
const INPUT_TEXT_TOP = document.getElementById(
  "input-text-top",
) as HTMLInputElement;
const INPUT_TEXT_BOTTOM = document.getElementById(
  "input-text-bottom",
) as HTMLInputElement;
const INPUT_FONT_SIZE = document.getElementById(
  "input-number-font-size",
) as HTMLInputElement;
const INPUT_STRIPE_COUNT = document.getElementById(
  "input-number-stripe-count",
) as HTMLInputElement;
const INPUT_STRIPE_HEIGHT_PERCENT = document.getElementById(
  "input-number-stripe-height-percent",
) as HTMLInputElement;
const INPUT_LOAD = document.getElementById(
  "input-load-image",
) as HTMLInputElement;
const BUTTON_LOAD = document.getElementById(
  "button-load-image",
) as HTMLButtonElement;
const BUTTON_SAVE = document.getElementById(
  "button-save-image",
) as HTMLButtonElement;
const BUTTON_COPY = document.getElementById(
  "button-copy-image",
) as HTMLButtonElement;

// Input listeners.
[
  INPUT_TEXT_TOP,
  INPUT_TEXT_BOTTOM,
  INPUT_FONT_SIZE,
  INPUT_STRIPE_COUNT,
  INPUT_STRIPE_HEIGHT_PERCENT,
].forEach((el) => {
  el.addEventListener("keyup", () => renderThrottled());
  el.addEventListener("change", () => renderThrottled());
});

// Upload image.
BUTTON_LOAD.addEventListener("click", () => {
  indicateButtonPressedState(BUTTON_LOAD, "image uploading...");
  INPUT_LOAD.click();
});
INPUT_LOAD.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageArrayBuffer = e.target?.result as ArrayBuffer;
      log("uploaded image size:", imageArrayBuffer.byteLength, "bytes");
      await sendAndReceiveFromWorker({
        command: "set_image",
        data: {arrayBuffer: imageArrayBuffer},
      });
      renderThrottled();
    };
    reader.readAsArrayBuffer(file);
  }
});

// Save image.
BUTTON_COPY.addEventListener("click", async () => {
  indicateButtonPressedState(BUTTON_COPY, "image copied");

  if (lastImageBlob == null) {
    err("failed to copy image: blob is null");
    return;
  }

  const clipboardItem = new ClipboardItem({"image/png": lastImageBlob});
  try {
    await navigator.clipboard.write([clipboardItem]);
    log("image copied to clipboard");
  } catch (e) {
    err("failed to copy image:", e);
  }
});

// Save image.
BUTTON_SAVE.addEventListener("click", () => {
  indicateButtonPressedState(BUTTON_SAVE, "image saved");

  if (lastImageBlob == null) {
    return;
  }

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(lastImageBlob);
  downloadLink.download = "image-with-stripes.png";
  downloadLink.click();

  URL.revokeObjectURL(downloadLink.href);
});

window.addEventListener("resize", async () => {
  resizeCanvas();
  await renderThrottled({force: true});
});

function indicateButtonPressedState(
  button: HTMLButtonElement,
  text: string,
): void {
  const originalText = button.innerText;
  button.innerText = text;
  button.disabled = true;
  setTimeout(() => {
    button.innerText = originalText;
    button.disabled = false;
  }, 1000);
}

function resizeCanvas(): void {
  const parent = CANVAS.parentElement;
  if (parent == null) {
    throw new Error("Bad canvas");
  }

  parent.style.padding = `${CANVAS_PADDING}px`;

  CANVAS.width = parent.clientWidth - 2 * CANVAS_PADDING;
  CANVAS.height = parent.clientHeight - 2 * CANVAS_PADDING;
}

// TODO: add `setError`
function setLoading(text: string | null) {
  const isLoading = text != null;

  BUTTON_LOAD.disabled = isLoading;
  BUTTON_COPY.disabled = isLoading;
  BUTTON_SAVE.disabled = isLoading;
  LOADING_MASK.style.opacity = isLoading ? "0.8" : "0";

  if (text != null) {
    LOADING_MASK_TEXT.innerHTML = text;
  }
}

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    return Promise.reject(
      new Error(
        `Failed to fetch "${url}": ${response.status}: ${response.statusText}`,
      ),
    );
  }
  return response.arrayBuffer();
}

function readParams(): ParamsType {
  return {
    textTop: String(INPUT_TEXT_TOP.value) ?? "",
    textBottom: String(INPUT_TEXT_BOTTOM.value) ?? "",
    fontSize: Math.max(parseInt(INPUT_FONT_SIZE.value, 10) || 0, 1),
    stripeCount: Math.max(parseInt(INPUT_STRIPE_COUNT.value, 10) || 0, 1),
    stripeHeightPercent: Math.max(
      parseInt(INPUT_STRIPE_HEIGHT_PERCENT.value, 10) || 0,
      1,
    ),
  };
}

function isEqualParams(
  params1: ParamsType | null,
  params2: ParamsType | null,
): boolean {
  if (params1 != null && params2 != null) {
    return (Object.keys(params1) as Array<keyof ParamsType>).reduce(
      (result, key) => result && params1[key] == params2[key],
      true,
    );
  }
  return false;
}

async function renderInWorker(params: ParamsType): Promise<void> {
  // Render in the rust worker.
  const response = await sendAndReceiveFromWorker({
    command: "draw_image",
    data: {params},
  });

  // Make ts happy.
  if (response.command != "draw_image") {
    return;
  }

  // Draw the result on the canvas.
  const stopDrawingTimer = startTimer("drawing on canvas");
  renderOnCanvasFromArrayBuffer(response.data);
  stopDrawingTimer();
}

async function renderOnCanvasFromArrayBuffer(
  imageBytes: Uint8Array,
): Promise<void> {
  const {promise, resolve, reject} = makePromise<void>();

  // TODO: consider: `{type: 'image/jpeg'}`.
  const imageBlob = new Blob([imageBytes], {type: "image/png"});
  lastImageBlob = imageBlob;

  const url = URL.createObjectURL(imageBlob);
  const image = new Image();

  image.src = url;
  image.onerror = reject;
  image.onload = () => {
    const canvasWidth = CANVAS.width;
    const canvasHeight = CANVAS.height;
    const imageWidth = image.width;
    const imageHeight = image.height;

    const aspectRatio = imageWidth / imageHeight;

    let drawWidth, drawHeight;

    if (canvasWidth / canvasHeight > aspectRatio) {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * aspectRatio;
    } else {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / aspectRatio;
    }

    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;

    const ctx = CANVAS.getContext("2d");
    if (ctx == null) {
      reject("Failed to get canvas context");
      return;
    }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    URL.revokeObjectURL(url);
    resolve();
  };

  return promise;
}

// Renders right away, if there is a render request during the current render,
// calls render again after the current one has finished.
let isRendering = false;
let isRerenderRequested = false;
let renderedParams: ParamsType | null = null;
async function renderThrottled(
  {force}: {force: boolean} = {force: false},
): Promise<void> {
  setLoading("drawing");

  if (isRendering) {
    log("re-render requested");
    isRerenderRequested = true;
    return;
  }

  try {
    isRendering = true;
    const params = readParams();
    if (force === true || !isEqualParams(params, renderedParams)) {
      renderedParams = params;
      await renderInWorker(params);
    }
  } finally {
    isRendering = false;
  }

  if (isRerenderRequested) {
    isRerenderRequested = false;
    setTimeout(() => renderThrottled(), 0);
  } else {
    setLoading(null);
  }
}

// TODO: add support for concurrent calls?
async function sendAndReceiveFromWorker(
  message: WorkerRequestType,
): Promise<WorkerResponseSuccessType> {
  const endTimer = startTimer(`sending command:${message.command} to worker`);

  const {promise, resolve, reject} = makePromise<WorkerResponseSuccessType>();
  worker.onmessageerror = makeWorkerOnMessageErrorHandler(reject, endTimer);
  worker.onmessage = makeWorkerOnMessageHandler(resolve, reject, endTimer);
  worker.onerror = makeWorkerOnErrorHandler(reject, endTimer);

  switch (message.command) {
    case "ping":
    case "draw_image":
      worker.postMessage(message);
      break;
    case "set_font":
    case "set_image":
      // Transfer ownership to free up memory in the main thread:
      // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
      worker.postMessage(message, [message.data.arrayBuffer]);
      break;
    default:
      throw new Error(`Unsupported command`);
  }

  return promise;
}

function makeWorkerOnMessageHandler(
  resolve: (data: WorkerResponseSuccessType) => void,
  reject: (reason: Error) => void,
  endTimer: () => void,
): (event: MessageEvent<WorkerResponseType>) => void {
  return (event: MessageEvent<WorkerResponseType>) => {
    endTimer();
    const {command, error} = event.data;
    if (error == null) {
      log(`response from worker: command:${command}`);
      switch (command) {
        case "ping":
        case "set_font":
        case "set_image":
          resolve(event.data);
          break;
        case "draw_image":
          const {data} = event.data;
          log("received from worker", data.length, "bytes");
          resolve(event.data);
          break;
        default:
          reject(new Error(`Unsupported command: ${command}`));
      }
    } else {
      err(`response from worker: command:${command} error:`, error);
      reject(error);
    }
  };
}

function makeWorkerOnMessageErrorHandler(
  reject: (reason: MessageEvent) => void,
  endTimer: () => void,
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    endTimer();
    err("messageerror in worker:", event);
    reject(event);
  };
}

function makeWorkerOnErrorHandler(
  reject: (reason: Error) => void,
  endTimer: () => void,
): (error: ErrorEvent) => void {
  return (e: ErrorEvent) => {
    endTimer();
    err("error in worker:", e);
    reject(e.error);
  };
}

function makePromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {promise, resolve, reject};
}

window.addEventListener("load", async () => {
  try {
    setLoading("loading");

    // Fetch font and demo image.
    const stopTimer = startTimer("loading font / demo image");
    let [fontArrayBuffer, imageArrayBuffer] = await Promise.all([
      fetchAsArrayBuffer(URL_FONT),
      fetchAsArrayBuffer(URL_RANDOM_DEMO_IMAGE),
    ]);

    // TODO: make this ping wait for worker init?
    await sendAndReceiveFromWorker({command: "ping"});

    log("font size:", fontArrayBuffer.byteLength, "bytes");
    await sendAndReceiveFromWorker({
      command: "set_font",
      data: {arrayBuffer: fontArrayBuffer},
    });

    log("image size:", imageArrayBuffer.byteLength, "bytes");
    await sendAndReceiveFromWorker({
      command: "set_image",
      data: {arrayBuffer: imageArrayBuffer},
    });

    stopTimer();

    // Initial canvas fitting.
    resizeCanvas();

    // Render demo.
    await renderThrottled();
    log("demo rendered");
  } catch (e) {
    err("Failed to start the app: ", e);
  }
});

log("loading...");
