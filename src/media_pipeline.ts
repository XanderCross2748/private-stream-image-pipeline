import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiMediaClient, ResizeInput } from "./infrai_client.js";

export const assetRequestSchema = z.object({
  assetId: z.string().uuid(),
  image: z.string().min(1),
  filename: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/),
  delivery: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }).strict()
}).strict();

export type AssetRequest = z.infer<typeof assetRequestSchema>;

export interface AssetJob {
  id: string;
  assetId: string;
  state: "queued" | "processing" | "ready" | "rejected";
  delivery?: unknown;
  error?: string;
}

export function deliveryPlan(input: AssetRequest): ResizeInput {
  return {
    image: input.image,
    width: Math.min(input.delivery.width, 1920),
    height: Math.min(input.delivery.height, 1080),
    fit: "cover",
    enlarge: false,
    format: "webp",
    store: true,
    idempotency_key: `${input.assetId}:delivery`
  };
}

export function jobIdFor(assetId: string): string {
  return createHash("sha256").update(assetId).digest("hex").slice(0, 24);
}

export async function processAsset(
  infrai: InfraiMediaClient,
  input: AssetRequest,
  job: AssetJob
): Promise<void> {
  job.state = "processing";
  try {
    const uploaded = await infrai.image.upload({
      file: input.image,
      filename: input.filename,
      idempotency_key: `${input.assetId}:ingest`
    });
    job.delivery = await infrai.image.resize({ ...deliveryPlan(input), image: { image_id: uploaded.image_id } });
    job.state = "ready";
  } catch (error) {
    job.state = "rejected";
    job.error = error instanceof Error ? error.message : "Media processing was rejected";
  }
}
