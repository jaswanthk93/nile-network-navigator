
import { useState } from "react";
import { AuthFormLayout } from "@/components/auth/AuthFormLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

const RegisterPage = () => {
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <AuthFormLayout
      title="Create an account"
      subtitle="Enter your information to create an account"
      error={formError}
    >
      <RegisterForm onError={setFormError} />
    </AuthFormLayout>
  );
};

export default RegisterPage;
