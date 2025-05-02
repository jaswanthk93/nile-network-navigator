
import { useState } from "react";
import { AuthFormLayout } from "@/components/auth/AuthFormLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

const RegisterPage = () => {
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <AuthFormLayout
      title="Create an account"
      subtitle="Enter your information to create an account"
      error={formError}
    >
      <Alert className="mb-4">
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          New accounts require administrator approval before they can be used.
        </AlertDescription>
      </Alert>
      <RegisterForm onError={setFormError} />
    </AuthFormLayout>
  );
};

export default RegisterPage;
