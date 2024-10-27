export type ParamsType = {
  textTop: string;
  textBottom: string;
  fontSize: number;
  stripeCount: number;
  stripeHeightPercent: number;
};

export type WorkerRequestSetArrayBufferDataType = {
  arrayBuffer: ArrayBuffer;
};

export type WorkerRequestDrawImageDataType = {
  params: ParamsType;
};

export type WorkerRequestType =
  | {command: "ping"}
  | {command: "set_font"; data: WorkerRequestSetArrayBufferDataType}
  | {command: "set_image"; data: WorkerRequestSetArrayBufferDataType}
  | {command: "draw_image"; data: WorkerRequestDrawImageDataType};

export type WorkerResponseType =
  | WorkerResponseSuccessType
  | WorkerResponseErrorType;

export type WorkerResponseSuccessType =
  | {command: "ping"; error: null}
  | {command: "set_font"; error: null}
  | {command: "set_image"; error: null}
  | {command: "draw_image"; error: null; data: Uint8Array};

export type WorkerResponseErrorType =
  | {command: "ping"; error: Error}
  | {command: "set_font"; error: Error}
  | {command: "set_image"; error: Error}
  | {command: "draw_image"; error: Error};
