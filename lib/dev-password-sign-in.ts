/** Password sign-in is only for a non-production server. Production keeps email OTP. */
export function isDevPasswordSignIn(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv !== "production";
}

/** Localhost and the current trycloudflare tunnel may post the dev password form. */
export function isDevTrustedOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}
