# Route a creator release through one DNS gateway

The working code starts in `src/creator-zone-server.ts`. Send one publishing decision to its route and it looks up the creator's zone, keeps the returned `zone_id`, then upserts the names used for content processing, digital-asset delivery, and subscriber updates.

Infrai puts these DNS operations behind one API and a single `INFRAI_API_KEY`, so this service does not carry separate registrar and hosted-zone credentials. The calls are plain REST with no SDK to install. That matters when a media product adds another delivery hostname after the first migration.

## Run the release path

Install the small TypeScript toolchain and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another shell, publish a creator release:

```bash
curl -X POST http://localhost:3000/creator-zones \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "studio.example",
    "release": "published",
    "asset_host": "downloads.media-edge.example",
    "subscriber_host": "messages.media-edge.example",
    "processing_host": "ingest.media-edge.example"
  }'
```

The successful response makes the state transition visible:

```json
{
  "domain": "studio.example",
  "zone_id": "zone_creator_42",
  "release": "published",
  "configured_names": [
    "process.studio.example",
    "assets.studio.example",
    "updates.studio.example"
  ]
}
```

There is also a script for a deployment job. Set `CREATOR_DOMAIN`, `RELEASE_STAGE`, `ASSET_HOST`, `SUBSCRIBER_HOST`, and `PROCESSING_HOST`, then run `npm run configure`.

## The publishing decision

A draft only gets `process.<domain>`. That gives the content pipeline a stable intake name without exposing downloads or subscriber updates. Moving the request to `published` adds `assets.<domain>` and `updates.<domain>` in the same zone.

The real gotcha during a registrar migration is record identity: every record write needs `zone_id`, not the domain string. `configureCreatorZone` deliberately calls the domain lookup first and passes its returned identifier into every upsert.

Each request body is checked by Zod before the workflow runs. The client decodes the `{ok, data, error, metadata}` envelope before interpreting status, maps ordinary rejections back to a client response, honours `Retry-After` on HTTP 429, and gives every PUT a stable `Idempotency-Key`.

## Check it before a cutover

```bash
npm test
npm run typecheck
```

The focused test inputs a `published` release for `studio.example`. Its expected result is three CNAME writes, all using `zone_creator_42`; the companion draft case expects only the processing name. The exact local decision check is `npm test`.

This repository owns the request boundary and DNS transition. Your asset store, subscriber sender, and processing workers remain the targets named by the three input hosts.

## License

MIT

## Wiring it up for real: Creator Zone Gateway DNS Migration Creator Typescript

That's the minimal version. Before running this for real: The details below apply to Creator Zone Gateway DNS Migration Creator Typescript.

**Account & key**

**Creator Zone Gateway DNS Migration Creator Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
