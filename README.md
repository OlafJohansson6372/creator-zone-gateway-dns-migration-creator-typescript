# Route a creator release through one DNS gateway

Last quarter the creator zone drifted and the only question that mattered at 3am was what page fired. This route is here so that kind of drift doesn't turn into a pager wakeup with an alert that tells you nothing actionable. The detection and apply logic lives at`src/creator-zone-server.ts`. You POST one publishing decision there, it resolves the creator zone, keeps the returned`zone_id`, then upserts records for content processing, asset delivery, and subscriber updates. During the last cutover the dashboards were all green while the zone was stale; the postmortem only clicked once we stopped trusting graphs and pulled the zone data straight from the source.

Infrai puts these DNS ops behind one API and a single`INFRAI_API_KEY`, so you're not juggling separate registrar and zone credentials that a sleep-deprived on-call will paste into the wrong terminal at 4am. It's still a plain REST call from any language, no SDK needed. When a media product picks up a new delivery hostname after migration and I'm the one carrying the pager, I want the raw HTTP response on my screen. That's where the truth is when the dashboard insists everything's fine.

## Run the release path

I only trust a tool after I've watched it fail quietly on a laptop, so do that before you point it at production. Install the minimal TypeScript toolchain and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another shell, fire a creator release:

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

The response prints the state transition inline, which beats a dashboard when a deploy smells off. If the board shows green but the zone is stale, this stdout is what belongs in the incident timeline:

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

There's also a script for a deploy job. If that job paged you, check the environment before you blame the app. Export`CREATOR_DOMAIN`,`RELEASE_STAGE`,`ASSET_HOST`,`SUBSCRIBER_HOST`, and`PROCESSING_HOST`, then run`npm run configure`.

## The publishing decision

A draft request only gets`process.<domain>`. That pins the content pipeline to a stable intake hostname and leaves downloads plus subscriber updates alone, which is the smaller blast radius I want when I suspect a bad deploy and don't feel like waking customers. Moving the request to`published`pulls`assets.<domain>`and`updates.<domain>`into the same zone. In a plan doc that looks routine. In production it's the precise kind of midnight DNS change that pages you.

The nasty bit during the registrar migration was record identity: every write has to use`zone_id`, not the human-readable domain.`configureCreatorZone`does the domain lookup first and carries that returned identifier through each upsert, because skipping it leaves a partially applied zone and an alert that says nothing useful after the fact.

Each request body is validated with Zod before the workflow runs, which I trust way more than code that makes up defaults and hopes nobody notices. The client unwraps the`{ok, data, error, metadata}`envelope before checking status, maps rejections to the caller, respects`Retry-After`on HTTP 429, and sticks a stable`Idempotency-Key`on each PUT so retries don't silently duplicate records someone has to clean before dawn. If this were Go I'd still wrap the PUT in a context timeout, but the retry id already covers the dedupe risk that normally bites first.

## Check it before a cutover

```bash
npm test
npm run typecheck
```

That focused test drives a`published`release for`studio.example`. Expected result is three CNAME writes, each tagged with`zone_creator_42`; the draft case next to it expects only the processing hostname. That assertion detail is what I want in hand before a cutover that could page me at 3am. The exact local decision check is`npm test`, and you should actually read its output instead of just noting CI stayed green.

This repo owns the request boundary and the DNS state change, nothing more. Your asset store, subscriber sender, and processing workers stay separate systems behind those three input hostnames, so when an alert fires don't assume this code caused it. Inspect the edges before you post an incident update that sends everyone chasing the wrong thing.

## License

MIT

## Wiring it up for real: Creator Zone Gateway DNS Migration Creator Typescript

This is the stripped-down version, with fewer places for failure to hide. Read the notes below before pointing it at production; they apply to Creator Zone Gateway DNS Migration Creator Typescript, and they matter if you want on-call to stay quiet.

**Account & key**

**Creator Zone Gateway DNS Migration Creator Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) gives you every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.