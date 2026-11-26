// @vitest-environment node
import { runSpiralBackend } from "./spiralBackend";

const reply = (status, body) => async () => new Response(body, { status });
const call = (fetchImpl) => runSpiralBackend({ url: "http://b.test", drawData: [], timeoutMs: 1000, fetchImpl });

describe("runSpiralBackend", () => {
  it("returns the metrics object", async () => {
    await expect(call(reply(200, '{"DOS":"1.2"}'))).resolves.toEqual({ DOS: "1.2" });
  });

  it("marks server errors retryable and client errors not", async () => {
    await expect(call(reply(503, "busy"))).rejects.toMatchObject({ retryable: true, status: 503 });
    await expect(call(reply(400, "bad"))).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  it("treats a timeout status in the body as a retryable failure", async () => {
    await expect(call(reply(200, '{"status":"timeout"}'))).rejects.toMatchObject({ retryable: true });
  });

  it("rejects empty and non-object answers", async () => {
    await expect(call(reply(200, " "))).rejects.toMatchObject({ retryable: true });
    await expect(call(reply(200, "[1,2]"))).rejects.toMatchObject({ retryable: false });
  });

  it("always sends point fields in the order MATLAB reads them", async () => {
    let sent;
    const capture = async (_url, init) => {
      sent = init.body;
      return new Response('{"DOS":"1"}', { status: 200 });
    };
    // The order Postgres jsonb hands back.
    await runSpiralBackend({ url: "http://b.test", drawData: [{ n: 1, p: 300, t: 0, x: 1.5, y: 150, extra: 1 }], timeoutMs: 1000, fetchImpl: capture });
    expect(sent).toBe('[{"n":1,"x":1.5,"y":150,"p":300,"t":0}]');
  });

  it("reports a timeout as such", async () => {
    const hang = (_url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    await expect(runSpiralBackend({ url: "http://b.test", drawData: [], timeoutMs: 20, fetchImpl: hang }))
      .rejects.toMatchObject({ retryable: true, timedOut: true });
  });
});
