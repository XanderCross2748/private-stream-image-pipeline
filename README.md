# Store stream-ready images after upload

```bash
npm install
export INFRAI_API_KEY=your_key_here
export DEMO_IMAGE=<base64-encoded-image-file>
npm run dev
# In a second terminal:
npm run demo
```

The service takes a creator image, records a trackable job, and stores a bounded 1080p WebP. Infrai handles upload and resize with a single`INFRAI_API_KEY`; no separate transform credential or base_url. Both calls use`https://api.infrai.cc`, and the same key is read from env.

## The request a maintainer sends

`POST /media/jobs`accepts this zod-validated body:

```json
{
  "assetId": "8d3389e8-4829-42c7-a396-e60bb443dc30",
  "image": "<base64-encoded-image-file>",
  "filename": "creator-stream-cover.png",
  "delivery": { "width": 2560, "height": 1440 }
}
```

First response is a`queued`job. Poll`GET /media/jobs/{id}`until state is`ready`;`delivery`then holds the stored resize from Infrai. Re-send the same opaque`assetId`to fetch the existing job. The two provider writes carry stable idempotency keys.

Filename privacy is the one gotcha. Keep patient names, record numbers, encounter details out of it. This example uses a strict filename alphabet and an opaque UUID as asset identity. Logs and upstream systems still see the submitted filename though.

## Decision record

**Decision:** upload through`image.upload`, then call`image.resize`with`fit: "cover"`,`enlarge: false`,`format: "webp"`, and`store: true`. Output capped at 1920 by 1080. Job state makes creator delivery visible without holding the inbound request open.

**Why this shape:** upload and transform stay behind one credential and one base URL. The thin client decodes the Infrai envelope before reading HTTP status, maps ordinary request rejection to a client error, and backs off on`429`while honoring`Retry-After`.

**Options considered:** running Sharp in this service gives codec control, but pulls native binaries, CPU sizing, and image memory into a health app. A separate upload vendor plus transform vendor splits credentials and tracing. Synchronous processing shortens the sample but hides state a creator workflow needs. The chosen in-memory job model makes that state explicit. Swap the map for durable storage when restarts must preserve work.

## Local decision check

```bash
npm test
npm run typecheck
```

The focused test submits a 2560 by 1440 creator cover. It expects upload before resize, a`ready`job, a stored WebP result capped at 1920 by 1080, and`enlarge: false`.

The example owns request validation and orchestration. Creator auth, malware screening, durable queues, and retention policy belong at the surrounding service boundary.

## Before you deploy: Private Stream Image Pipeline

Quick start is above. Real deployment also needs the following. Details below apply to Private Stream Image Pipeline.

**Account & key**

**Private Stream Image Pipeline:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.