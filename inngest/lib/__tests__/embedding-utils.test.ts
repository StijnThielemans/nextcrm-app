describe("embedding-utils", () => {
  const previous = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    jest.resetModules();
  });

  it("imports without an OpenAI key and only fails when an embedding is requested", async () => {
    delete process.env.OPENAI_API_KEY;
    const utils = await import("../embedding-utils");
    expect(utils.buildEmbeddingText(["a", "", null, "b"])).toBe("a b");
    await expect(utils.generateEmbedding("hello")).rejects.toThrow("OPENAI_API_KEY is not set");
  });
});
