import { isDevPasswordSignIn, isDevTrustedOrigin } from "@/lib/dev-password-sign-in";

describe("dev password sign-in", () => {
  it("stays off in production and on for the dev server", () => {
    expect(isDevPasswordSignIn("production")).toBe(false);
    expect(isDevPasswordSignIn("development")).toBe(true);
    expect(isDevPasswordSignIn("test")).toBe(true);
  });

  it("trusts localhost and a trycloudflare tunnel only", () => {
    expect(isDevTrustedOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isDevTrustedOrigin("http://localhost:3000")).toBe(true);
    expect(isDevTrustedOrigin("https://anything-caribbean-half-latinas.trycloudflare.com")).toBe(true);
    expect(isDevTrustedOrigin("https://example.com")).toBe(false);
    expect(isDevTrustedOrigin("not a url")).toBe(false);
  });
});
