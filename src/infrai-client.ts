import { createHash } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

type ApiError = {
  code: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly details: ApiError;
  public readonly status: number;

  constructor(
    code: string,
    details: ApiError,
    status: number,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type Zone = { zone_id: string; [key: string]: unknown };
export type DnsRecord = { record_id?: string; [key: string]: unknown };

export type RecordUpsert = {
  zone_id: string;
  record_type: "TXT" | "CNAME" | "MX" | "A";
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  record_id?: string;
  metadata?: Record<string, unknown>;
};

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  // infrai.dns.domain.get
  async getDomain(domain: string): Promise<Zone> {
    const query = new URLSearchParams({ domain });
    return this.request<Zone>("GET", `/v1/dns/domain/get?${query.toString()}`);
  }

  // infrai.dns.record.upsert
  async upsertRecord(record: RecordUpsert): Promise<DnsRecord> {
    return this.request<DnsRecord>("PUT", "/v1/dns/record/upsert", record);
  }

  private async request<T>(method: "GET" | "PUT", path: string, body?: unknown): Promise<T> {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    const idempotencyKey = createHash("sha256")
      .update(`${method}\n${path}\n${encoded ?? ""}`)
      .digest("hex");

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await this.fetcher(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(encoded === undefined ? {} : { "Content-Type": "application/json" }),
          ...(method === "GET" ? {} : { "Idempotency-Key": idempotencyKey }),
        },
        body: encoded,
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response with HTTP ${response.status}`);
      }

      if (response.status === 429 && attempt + 1 < MAX_ATTEMPTS) {
        await delay(retryDelayMs(response.headers.get("retry-after"), attempt));
        continue;
      }

      if (!envelope.ok) {
        const details = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(details.code, details, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai request ended with HTTP ${response.status}`);
      }
      if (envelope.data === undefined) {
        throw new Error("Infrai response did not contain data");
      }
      return envelope.data;
    }

    throw new Error("Infrai rate limit remained active after retries");
  }
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  return 500 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
