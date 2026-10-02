import { z } from "zod";
import type { DnsRecord, RecordUpsert, Zone } from "./infrai-client.js";

export const creatorZoneInput = z.object({
  domain: z.string().min(1),
  release: z.enum(["draft", "published"]),
  asset_host: z.string().min(1),
  subscriber_host: z.string().min(1),
  processing_host: z.string().min(1),
});

export type CreatorZoneInput = z.infer<typeof creatorZoneInput>;

export interface DnsGateway {
  getDomain(domain: string): Promise<Zone>;
  upsertRecord(record: RecordUpsert): Promise<DnsRecord>;
}

export type PlannedRecord = Pick<RecordUpsert, "record_type" | "name" | "content" | "ttl">;

export function planCreatorRecords(input: CreatorZoneInput): PlannedRecord[] {
  const processing: PlannedRecord = {
    record_type: "CNAME",
    name: `process.${input.domain}`,
    content: input.processing_host,
    ttl: 300,
  };
  if (input.release === "draft") return [processing];

  return [
    processing,
    {
      record_type: "CNAME",
      name: `assets.${input.domain}`,
      content: input.asset_host,
      ttl: 300,
    },
    {
      record_type: "CNAME",
      name: `updates.${input.domain}`,
      content: input.subscriber_host,
      ttl: 300,
    },
  ];
}

export async function configureCreatorZone(gateway: DnsGateway, input: CreatorZoneInput) {
  const zone = await gateway.getDomain(input.domain);
  const planned = planCreatorRecords(input);

  await Promise.all(
    planned.map((record) =>
      gateway.upsertRecord({
        zone_id: zone.zone_id,
        ...record,
        metadata: { workflow: "creator_content_delivery", release: input.release },
      }),
    ),
  );

  return {
    domain: input.domain,
    zone_id: zone.zone_id,
    release: input.release,
    configured_names: planned.map((record) => record.name),
  };
}
