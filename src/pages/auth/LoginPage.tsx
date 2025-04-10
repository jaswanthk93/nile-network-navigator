
import { useState } from "react";
import { AuthFormLayout } from "@/components/auth/AuthFormLayout";
import { LoginForm } from "@/components/auth/LoginForm";

const LoginPage = () => {
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <AuthFormLayout
      title="Welcome back"
      subtitle="Enter your credentials to sign in to your account"
      error={formError}
    >
      <LoginForm onError={setFormError} />
    </AuthFormLayout>
  );
};

export default LoginPage;
