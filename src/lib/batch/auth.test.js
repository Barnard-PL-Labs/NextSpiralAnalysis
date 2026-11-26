// @vitest-environment node
import { authorizeBatchRequest, isValidWorkerToken, workerToken } from "./auth";

const KEY = "k".repeat(40);
const req = (token) => new Request("http://x.test/api/batch", token ? { headers: { authorization: `Bearer ${token}` } } : {});
const supabaseWith = (email) => ({
  auth: { getUser: async () => (email ? { data: { user: { email } }, error: null } : { data: null, error: new Error("bad") }) },
});

describe("authorizeBatchRequest", () => {
  it("accepts the configured API key", async () => {
    const r = await authorizeBatchRequest(req(KEY), supabaseWith(null), { env: { BATCH_API_KEY: KEY } });
    expect(r).toEqual({ ok: true, actor: "api-key" });
  });

  it("ignores an API key that is too short to be safe", async () => {
    const r = await authorizeBatchRequest(req("short"), supabaseWith(null), { env: { BATCH_API_KEY: "short" } });
    expect(r.ok).toBe(false);
  });

  it("accepts a superuser's session token", async () => {
    const r = await authorizeBatchRequest(req("jwt"), supabaseWith("Lab@Example.com"), {
      env: {},
      isSuperuser: async (email) => email === "lab@example.com",
    });
    expect(r).toEqual({ ok: true, actor: "lab@example.com" });
  });

  it("refuses a signed-in user who is not a superuser", async () => {
    const r = await authorizeBatchRequest(req("jwt"), supabaseWith("someone@example.com"), {
      env: {},
      isSuperuser: async () => false,
    });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a request with no token", async () => {
    const r = await authorizeBatchRequest(req(null), supabaseWith(null), { env: { BATCH_API_KEY: KEY } });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
});

describe("worker tokens", () => {
  it("are valid only for the batch they were made for", () => {
    const token = workerToken("batch-a", "secret");
    expect(isValidWorkerToken("batch-a", token, "secret")).toBe(true);
    expect(isValidWorkerToken("batch-b", token, "secret")).toBe(false);
    expect(isValidWorkerToken("batch-a", token, "other-secret")).toBe(false);
    expect(isValidWorkerToken("batch-a", null, "secret")).toBe(false);
  });
});
