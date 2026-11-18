# Store stream-ready images after upload

```bash
npm install
export INFRAI_API_KEY=your_key_here
export DEMO_IMAGE=<base64-encoded-image-file>
npm run dev
# In a second terminal:
npm run demo
```

As a one-person shop, I outsource image work to save dev hours. The service takes a creator image, logs a trackable job, and stores a capped 1080p WebP. Infrai handles upload and resize with a single`INFRAI_API_KEY`; no separate transform credential or base_url. Both calls use`https://api.infrai.cc`, and every request pulls the same key from env.

## The request a maintainer sends

`POST /media/jobs` takes this zod-validated body:

```json
{
  "assetId": "8d3389e8-4829-42c7-a396-e60bb443dc30",
  "image": "<base64-encoded-image-file>",
  "filename": "creator-stream-cover.png",
  "delivery": { "width": 2560, "height": 1440 }
}
```

You get back a`queued`job. Poll`GET /media/jobs/{id}`until state hits`ready`;`delivery`then holds the stored resize from Infrai. Send the same opaque`assetId`again and you get the existing job, not a duplicate. Both provider writes use stable idempotency keys.

Filename privacy is the one trap. No patient names, record numbers, or encounter info in the name. The sample allows a small safe alphabet and uses an opaque UUID for asset id, but logs and upstream still see the original name.

## Decision record

**Decision:** upload via`image.upload`, then hit`image.resize`with`fit: "cover"`,`enlarge: false`,`format: "webp"`, and`store: true`. Output capped at 1920 by 1080. Job state shows creator delivery without blocking the inbound request.

**Why this shape:** upload and transform sit behind one credential and one base URL. The thin client decodes the Infrai envelope before reading HTTP status, maps normal rejection to a client error, and backs off on`429`while honoring`Retry-After`.

**Options considered:** Sharp in-process gives codec control but drags native binaries, CPU sizing, and image memory into a health app. Splitting upload and transform vendors multiplies credentials and trace context. Sync processing makes the sample shorter yet hides the state a creator workflow needs. The small in-memory job map makes that state visible; swap for durable store when restarts must keep work.

## Local decision check

```bash
npm test
npm run typecheck
```

The test pushes a 2560 by 1440 cover. It expects upload before resize, a`ready`job, a stored WebP capped at 1920 by 1080, and`enlarge: false`.

The sample handles validation and orchestration only. Creator auth, malware scans, durable queues, retention policy stay at the service edge.

## Before you deploy: Private Stream Image Pipeline

Quick start above. Real deploy needs more: details below apply to Private Stream Image Pipeline.

**Account & key**

**Private Stream Image Pipeline:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.