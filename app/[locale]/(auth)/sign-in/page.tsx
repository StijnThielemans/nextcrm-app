import { LoginComponent } from "./components/LoginComponent";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";
import { ensureDevProjectLeaders, ensureDevSalesUsers, ensureDevTestPassword } from "@/lib/dev-test-password";

const SignInPage = async () => {
  const passwordSignIn = isDevPasswordSignIn();
  if (passwordSignIn) {
    await ensureDevTestPassword();
    await ensureDevSalesUsers();
    await ensureDevProjectLeaders();
  }
  return <LoginComponent passwordSignIn={passwordSignIn} />;
};

export default SignInPage;
