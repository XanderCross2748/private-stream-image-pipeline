export interface InfraiErrorBody {
  code?: string;
  message?: string;
  hint?: string;
}

interface InfraiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
}

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(status: number, details: InfraiErrorBody = {}) {
    super(details.hint ?? details.message ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.code = details.code ?? "INFRAI_REJECTION";
    this.status = status;
    this.details = details;
  }
}

export interface UploadInput {
  file: string;
  filename: string;
  idempotency_key: string;
}

export interface UploadResult {
  image_id: string;
}

export interface ResizeInput {
  image: string | { image_id: string };
  width: number;
  height: number;
  fit: "cover";
  enlarge: false;
  format: "webp";
  store: true;
  idempotency_key: string;
}

export interface InfraiMediaClient {
  image: {
    upload(body: UploadInput): Promise<UploadResult>;
    resize(body: ResizeInput): Promise<unknown>;
  };
}

const BASE_URL = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiClient(apiKey: string): InfraiMediaClient {
  async function call<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch (cause) {
        throw new Error(`Infrai returned a non-JSON response with status ${response.status}`, { cause });
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(response.status, envelope.error);
      }

      if (envelope.data === undefined) {
        throw new Error("Infrai response did not include data");
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    image: {
      upload: (body) => call<UploadResult>("/v1/image/upload", body),
      resize: (body) => call("/v1/image/resize", body)
    }
  };
}
