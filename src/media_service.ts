import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai_client.js";
import {
  assetRequestSchema,
  jobIdFor,
  processAsset,
  type AssetJob
} from "./media_pipeline.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = createInfraiClient(apiKey);
const jobs = new Map<string, AssetJob>();
const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function clientStatus(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    return error.status;
  }
  return 500;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/media/jobs") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const input = assetRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      const id = jobIdFor(input.assetId);
      const existing = jobs.get(id);
      if (existing) return json(response, 200, existing);

      const job: AssetJob = { id, assetId: input.assetId, state: "queued" };
      jobs.set(id, job);
      void processAsset(infrai, input, job);
      return json(response, 202, job);
    }

    if (request.method === "GET" && request.url?.startsWith("/media/jobs/")) {
      const id = request.url.slice("/media/jobs/".length);
      const job = jobs.get(id);
      return job ? json(response, 200, job) : json(response, 404, { error: "job_not_found" });
    }

    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    const status = clientStatus(error);
    const message = error instanceof Error ? error.message : "Request failed";
    return json(response, status, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Media service listening on http://localhost:${port}`);
});
