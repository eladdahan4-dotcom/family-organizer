import { extract, AiError } from "../../src/ai";
import { firebaseConfig, AI_MODEL } from "../../src/config";

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
      "https://firebasevertexai.googleapis.com/v1beta/projects/" + firebaseConfig.projectId + "/models/" + AI_MODEL + ":generateContent"
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
    [404, "setup"],
    [500, "other"],
  ])("HTTP %s is reported as %s", async (status, kind) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(httpError(status as number));
    await expect(extract("x")).rejects.toMatchObject({ kind });
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
