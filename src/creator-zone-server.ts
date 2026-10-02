import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { creatorZoneInput, configureCreatorZone } from "./creator-zone-service.js";
import { InfraiDnsClient, InfraiError } from "./infrai-client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const dns = new InfraiDnsClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-zones") {
    return sendJson(response, 404, { error: "route_not_found" });
  }

  try {
    const input = creatorZoneInput.parse(await readJson(request));
    const result = await configureCreatorZone(dns, input);
    return sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return sendJson(response, 400, { error: "invalid_request", issues: error.issues });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return sendJson(response, status, { error: error.code, details: error.details });
    }
    console.error(error);
    return sendJson(response, 500, { error: "request_failed" });
  }
}).listen(port, () => {
  console.log(`Creator zone service listening on http://localhost:${port}`);
});

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
