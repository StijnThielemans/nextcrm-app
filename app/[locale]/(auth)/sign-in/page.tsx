import { LoginComponent } from "./components/LoginComponent";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";
import { ensureDevTestPassword } from "@/lib/dev-test-password";

const SignInPage = async () => {
  const passwordSignIn = isDevPasswordSignIn();
  if (passwordSignIn) await ensureDevTestPassword();
  return <LoginComponent passwordSignIn={passwordSignIn} />;
};

export default SignInPage;
