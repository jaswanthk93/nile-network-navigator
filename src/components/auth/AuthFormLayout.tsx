
import { ReactNode } from "react";
import { NetworkIcon } from "lucide-react";

interface AuthFormLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  error?: string | null;
}

export function AuthFormLayout({ title, subtitle, children, error }: AuthFormLayoutProps) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <NetworkIcon className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {children}
    </div>
  );
}
