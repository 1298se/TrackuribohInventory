import { SignUpSignInFormCard } from "../../features/auth/components/SignUpSignInFormCard";
import { signupUser } from "../../features/auth/actions";
import { AuthCenteredContainer } from "../../features/auth/components/AuthCenteredContainer";

export default function LoginPage() {
  return (
    <AuthCenteredContainer>
      <SignUpSignInFormCard
        redirect="/signup/confirm"
        title="Sign up"
        cta="Sign up"
        description="Enter your email below to sign up to your account"
        formAction={signupUser}
        variant="signup"
      />
    </AuthCenteredContainer>
  );
}
