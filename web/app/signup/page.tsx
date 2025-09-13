import { SignUpSignInFormCard } from "../../features/auth/components/SignUpSignInFormCard";
import { signupUser } from "../../features/auth/actions";
import { AuthCenteredContainer } from "../../features/auth/components/AuthCenteredContainer";

export default function LoginPage() {
  return (
    <AuthCenteredContainer>
      <SignUpSignInFormCard
        redirect="/signup/confirm"
        title="Sign up to your account"
        cta="Sign up"
        description="Enter your email below to sign up to your account"
        formAction={signupUser}
        footer={
          <div className="mt-4 text-center text-sm">
            Have an account?{" "}
            <a href="/login" className="underline underline-offset-4">
              Login
            </a>
          </div>
        }
      />
    </AuthCenteredContainer>
  );
}
