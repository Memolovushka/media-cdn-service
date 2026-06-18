import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

const AuthPage = () => (
  <main className="flex min-h-svh items-center justify-center bg-background p-6">
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  </main>
);

export default AuthPage;
