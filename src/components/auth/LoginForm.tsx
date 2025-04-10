
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required." })
    .email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onError: (error: string) => void;
}

export function LoginForm({ onError }: LoginFormProps) {
  const { login, isLoading } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login({
        email: values.email,
        password: values.password,
      });
    } catch (error) {
      if (error instanceof Error) {
        onError(error.message);
      } else {
        onError("Invalid email or password.");
      }
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="example@company.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="••••••••" type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center text-sm">
        <Link to="#" className="text-primary hover:text-primary/80">
          Forgot password?
        </Link>
      </div>

      <div className="mt-4 text-center text-sm">
        Don't have an account?{" "}
        <Link to="/register" className="underline text-primary hover:text-primary/80">
          Sign up
        </Link>
      </div>
      
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <p>Demo access: demo@example.com / password</p>
      </div>
    </>
  );
}
