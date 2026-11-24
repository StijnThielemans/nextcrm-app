import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";
import { ac, admin, manager, user } from "@/lib/auth-permissions";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";

function authClientBaseURL() {
  if (!isDevPasswordSignIn()) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.BETTER_AUTH_URL;
}

export const authClient = createAuthClient({
  baseURL: authClientBaseURL(),
  plugins: [
    emailOTPClient(),
    adminClient({
      ac,
      roles: { admin, manager, user },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
