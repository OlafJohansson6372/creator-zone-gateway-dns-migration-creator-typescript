import assert from "node:assert/strict";
import test from "node:test";
import { configureCreatorZone, type CreatorZoneInput, type DnsGateway } from "../src/creator-zone-service.js";
import type { RecordUpsert } from "../src/infrai-client.js";

const published: CreatorZoneInput = {
  domain: "studio.example",
  release: "published",
  asset_host: "downloads.media-edge.example",
  subscriber_host: "messages.media-edge.example",
  processing_host: "ingest.media-edge.example",
};

test("a published release exposes processing, assets, and subscriber updates through one zone", async () => {
  const writes: RecordUpsert[] = [];
  const gateway: DnsGateway = {
    async getDomain() {
      return { zone_id: "zone_creator_42" };
    },
    async upsertRecord(record) {
      writes.push(record);
      return { record_id: `record_${writes.length}` };
    },
  };

  const result = await configureCreatorZone(gateway, published);

  assert.equal(result.zone_id, "zone_creator_42");
  assert.deepEqual(result.configured_names, [
    "process.studio.example",
    "assets.studio.example",
    "updates.studio.example",
  ]);
  assert.ok(writes.every((record) => record.zone_id === "zone_creator_42"));
});

test("a draft keeps delivery and subscriber names unpublished", async () => {
  const writes: RecordUpsert[] = [];
  const gateway: DnsGateway = {
    async getDomain() {
      return { zone_id: "zone_draft_7" };
    },
    async upsertRecord(record) {
      writes.push(record);
      return {};
    },
  };

  await configureCreatorZone(gateway, { ...published, release: "draft" });

  assert.deepEqual(writes.map((record) => record.name), ["process.studio.example"]);
});
