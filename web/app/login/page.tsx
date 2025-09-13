import { loginUser } from "../../features/auth/actions";
import { AuthCenteredContainer } from "../../features/auth/components/AuthCenteredContainer";
import { SignUpSignInFormCard } from "../../features/auth/components/SignUpSignInFormCard";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <AuthCenteredContainer>
      <SignUpSignInFormCard
        title="Login to your account"
        description="Enter your email below to login to your account"
        formAction={loginUser}
        redirect="/"
        cta="Login"
        footer={
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="underline underline-offset-4">
              Sign up
            </a>
          </div>
        }
      />
      <Button>Logout</Button>
    </AuthCenteredContainer>
  );
}
