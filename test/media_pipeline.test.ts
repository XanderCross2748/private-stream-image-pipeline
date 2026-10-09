import assert from "node:assert/strict";
import test from "node:test";
import type { InfraiMediaClient, ResizeInput, UploadInput } from "../src/infrai_client.js";
import { processAsset, type AssetJob, type AssetRequest } from "../src/media_pipeline.js";

test("a large creator image becomes a stored 1080p WebP delivery", async () => {
  const calls: Array<{ operation: string; body: UploadInput | ResizeInput }> = [];
  const client: InfraiMediaClient = {
    image: {
      async upload(body) {
        calls.push({ operation: "upload", body });
        return { image_id: "uploaded-image-id" };
      },
      async resize(body) {
        calls.push({ operation: "resize", body });
        return { asset: "stored-delivery" };
      }
    }
  };
  const input: AssetRequest = {
    assetId: "8d3389e8-4829-42c7-a396-e60bb443dc30",
    image: "https://media.example/opaque-source",
    filename: "stream-cover.png",
    delivery: { width: 2560, height: 1440 }
  };
  const job: AssetJob = { id: "job-1", assetId: input.assetId, state: "queued" };

  await processAsset(client, input, job);

  assert.equal(job.state, "ready");
  assert.deepEqual(job.delivery, { asset: "stored-delivery" });
  assert.deepEqual(calls.map((call) => call.operation), ["upload", "resize"]);
  assert.deepEqual(calls[1]?.body, {
    image: { image_id: "uploaded-image-id" },
    width: 1920,
    height: 1080,
    fit: "cover",
    enlarge: false,
    format: "webp",
    store: true,
    idempotency_key: `${input.assetId}:delivery`
  });
});
