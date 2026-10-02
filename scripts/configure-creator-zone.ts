import { configureCreatorZone, creatorZoneInput } from "../src/creator-zone-service.js";
import { InfraiDnsClient } from "../src/infrai-client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const input = creatorZoneInput.parse({
  domain: process.env.CREATOR_DOMAIN,
  release: process.env.RELEASE_STAGE,
  asset_host: process.env.ASSET_HOST,
  subscriber_host: process.env.SUBSCRIBER_HOST,
  processing_host: process.env.PROCESSING_HOST,
});

const result = await configureCreatorZone(new InfraiDnsClient(apiKey), input);
console.log(JSON.stringify(result, null, 2));
