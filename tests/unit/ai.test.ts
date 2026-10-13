import { extract, AiError } from "../../src/ai";
import { firebaseConfig, AI_MODELS } from "../../src/config";

const geminiReply = (obj: any, fenced = false) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: (fenced ? "```json\n" : "") + JSON.stringify(obj) + (fenced ? "\n```" : "") }] } }],
    }),
});

const httpError = (status: number, body = "{}") => ({ ok: false, status, text: async () => body });

describe("extract() talks to Gemini correctly", () => {
  test("sends text to the project's Firebase AI endpoint with the API key", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(geminiReply({ tasks: [], shopping: [] }));
    await extract("מחר טיול");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      "https://firebasevertexai.googleapis.com/v1beta/projects/" + firebaseConfig.projectId + "/models/" + AI_MODELS[0] + ":generateContent"
    );
    expect(init.method).toBe("POST");
    expect(init.headers["x-goog-api-key"]).toBe(firebaseConfig.apiKey);
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].parts).toHaveLength(1);
    expect(body.contents[0].parts[0].text).toContain("מחר טיול");
  });

  test("attaches the image with its real type", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(geminiReply({ tasks: [], shopping: [] }));
    await extract("", { base64: "iVBORw0KGgoAAA", mimeType: "image/jpeg" });
    const parts = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).contents[0].parts;
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: "iVBORw0KGgoAAA" } });
    expect(parts[0].text).toContain("An image is attached");
  });

  test("returns parsed tasks and shopping, also when wrapped in ```json", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      geminiReply({ tasks: [{ title: "פיג׳מה לגן", date: "2026-10-15", time: "", cat: "gan" }], shopping: [{ name: "במבה", qty: "1" }] }, true)
    );
    const r = await extract("x");
    expect(r.tasks[0]).toMatchObject({ title: "פיג׳מה לגן", date: "2026-10-15", cat: "gan" });
    expect(r.shopping[0]).toMatchObject({ name: "במבה", qty: "1" });
  });

  test.each([
    [429, "quota"],
    [403, "setup"],
    [400, "other"],
    [500, "other"],
  ])("HTTP %s from every model is reported as %s", async (status, kind) => {
    (global.fetch as jest.Mock).mockResolvedValue(httpError(status as number));
    await expect(extract("x")).rejects.toMatchObject({ kind });
  });

  test("a retired model (404) falls back to the next model", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(httpError(404, "model is no longer available"))
      .mockResolvedValueOnce(geminiReply({ tasks: [{ title: "ok", date: "", time: "", cat: "home" }], shopping: [] }));
    const r = await extract("x");
    expect(r.tasks[0].title).toBe("ok");
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(urls[0]).toContain("/models/" + AI_MODELS[0] + ":");
    expect(urls[1]).toContain("/models/" + AI_MODELS[1] + ":");
  });

  test("daily quota on the first model (429) falls back to the next model", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(httpError(429, "GenerateRequestsPerDayPerProjectPerModel-FreeTier"))
      .mockResolvedValueOnce(geminiReply({ tasks: [], shopping: [{ name: "חלב", qty: "" }] }));
    const r = await extract("x");
    expect(r.shopping[0].name).toBe("חלב");
    expect(r.model).toBe(AI_MODELS[1]);
  });

  test("a server error does not waste the other model's quota", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(httpError(500));
    await expect(extract("x")).rejects.toMatchObject({ kind: "other" });
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  test("if every model is unavailable it is reported as setup", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(httpError(404));
    await expect(extract("x")).rejects.toMatchObject({ kind: "setup" });
  });

  test("asks the model to think less, for speed", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(geminiReply({ tasks: [], shopping: [] }));
    await extract("x");
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  test("a model that rejects the speed setting is asked again without it", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(httpError(400, "Request contains an invalid argument."))
      .mockResolvedValueOnce(geminiReply({ tasks: [{ title: "ok", date: "", time: "", cat: "home" }], shopping: [] }));
    const r = await extract("x");
    expect(r.tasks[0].title).toBe("ok");
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe(calls[1][0]); // same model
    expect(JSON.parse(calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  test("no answer in time is reported as timeout, not as no internet", async () => {
    (global.fetch as jest.Mock).mockImplementation((_u: string, init: any) =>
      new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))
    );
    await expect(extract("x", undefined, 30)).rejects.toMatchObject({ kind: "timeout" });
  });

  test("no internet is reported as network", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("Network request failed"));
    const e = await extract("x").catch((e) => e);
    expect(e).toBeInstanceOf(AiError);
    expect(e.kind).toBe("network");
  });

  test("an unreadable answer is reported as bad", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html>" });
    await expect(extract("x")).rejects.toMatchObject({ kind: "bad" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "Sorry" }] } }] }),
    });
    await expect(extract("x")).rejects.toMatchObject({ kind: "bad" });
  });
});
