const image = process.env.DEMO_IMAGE;
if (!image) throw new Error("Set DEMO_IMAGE to a base64-encoded image file");

const response = await fetch(`http://localhost:${process.env.PORT ?? 3000}/media/jobs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetId: "8d3389e8-4829-42c7-a396-e60bb443dc30",
    image,
    filename: "creator-stream-cover.png",
    delivery: { width: 2560, height: 1440 }
  })
});

console.log(await response.json());
