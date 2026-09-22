import {
  createConcurrencyGate,
  isOriginDownError,
  isOriginDownErrorMessage,
  isOriginDownHttpStatus,
  isRetryableHttpResponse,
  isSupabaseCircuitOpen,
  noteSupabaseOriginDown,
  resetSupabaseCircuit,
  shouldQueueDataFetch,
} from "@/lib/supabaseHttp.util";

function makeResponse(status: number, contentType = "application/json"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
  } as unknown as Response;
}

afterEach(() => {
  resetSupabaseCircuit();
});

describe("supabaseHttp origin-down vs transient", () => {
  it("marks 503, 504, 521, and 544 as origin-down statuses", () => {
    expect(isOriginDownHttpStatus(503)).toBe(true);
    expect(isOriginDownHttpStatus(504)).toBe(true);
    expect(isOriginDownHttpStatus(521)).toBe(true);
    expect(isOriginDownHttpStatus(544)).toBe(true);
    expect(isOriginDownHttpStatus(522)).toBe(false);
    expect(isOriginDownHttpStatus(500)).toBe(true);
  });

  it("does not retry origin-down HTTP responses", () => {
    expect(isRetryableHttpResponse(makeResponse(503))).toBe(false);
    expect(isRetryableHttpResponse(makeResponse(504))).toBe(false);
    expect(isRetryableHttpResponse(makeResponse(521))).toBe(false);
    expect(isRetryableHttpResponse(makeResponse(544))).toBe(false);
  });

  it("retries eligible transient statuses with backoff path", () => {
    expect(isRetryableHttpResponse(makeResponse(522))).toBe(true);
    expect(isRetryableHttpResponse(makeResponse(502))).toBe(true);
    expect(isRetryableHttpResponse(makeResponse(429))).toBe(true);
  });

  it("does not retry HTTP 500 (PostgREST Warp / statement timeout)", () => {
    expect(isRetryableHttpResponse(makeResponse(500))).toBe(false);
  });

  it("classifies origin-down messages including 57P03", () => {
    expect(isOriginDownErrorMessage("57P03 the database system is not accepting connections")).toBe(true);
    expect(isOriginDownErrorMessage("JWT expired")).toBe(false);
  });

  it("classifies plain objects by status/code even without digits in message", () => {
    expect(isOriginDownError({ message: "Service Unavailable", status: 503 })).toBe(true);
    expect(isOriginDownError({ message: "Web server is down", status: 521 })).toBe(true);
    expect(isOriginDownError({ message: "not accepting connections", code: "57P03" })).toBe(true);
    expect(isOriginDownError({ message: "JWT expired", code: "PGRST301", status: 401 })).toBe(false);
  });
});

describe("data fetch concurrency gate", () => {
  it("queues GET/HEAD data reads and skips auth + writes", () => {
    expect(shouldQueueDataFetch("https://x.supabase.co/rest/v1/trips")).toBe(true);
    expect(
      shouldQueueDataFetch("https://x.supabase.co/auth/v1/token", { method: "POST" }),
    ).toBe(false);
    expect(
      shouldQueueDataFetch("https://x.supabase.co/rest/v1/indents", { method: "POST" }),
    ).toBe(false);
  });

  it("never runs more than max acquires at once", async () => {
    const gate = createConcurrencyGate(2);
    let concurrent = 0;
    let maxConcurrent = 0;
    const job = async () => {
      await gate.acquire();
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 8));
      concurrent -= 1;
      gate.release();
    };
    await Promise.all([job(), job(), job(), job()]);
    expect(maxConcurrent).toBe(2);
    expect(gate.activeCount).toBe(0);
  });

  it("drops a queued acquire when the signal aborts", async () => {
    const gate = createConcurrencyGate(1);
    await gate.acquire();
    const controller = new AbortController();
    const pending = gate.acquire(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(gate.queuedCount).toBe(0);
    gate.release();
  });
});

describe("supabase origin-down circuit", () => {
  it("opens after an origin-down and classifies later errors as origin-down", () => {
    expect(isSupabaseCircuitOpen()).toBe(false);
    noteSupabaseOriginDown();
    expect(isSupabaseCircuitOpen()).toBe(true);
    expect(isOriginDownError({})).toBe(true);
    expect(isOriginDownError(new Error("Failed to fetch"))).toBe(true);
    resetSupabaseCircuit();
    expect(isSupabaseCircuitOpen()).toBe(false);
    expect(isOriginDownError({})).toBe(false);
  });
});
