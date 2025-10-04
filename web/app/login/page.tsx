import { loginUser } from "../../features/auth/actions";
import { AuthCenteredContainer } from "../../features/auth/components/AuthCenteredContainer";
import { SignUpSignInFormCard } from "../../features/auth/components/SignUpSignInFormCard";

export default function LoginPage() {
  return (
    <AuthCenteredContainer>
      <SignUpSignInFormCard
        title="Login"
        description="Enter your email below to login to your account"
        formAction={loginUser}
        redirect="/"
        cta="Login"
        variant="login"
      />
    </AuthCenteredContainer>
  );
}
