"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { GlobeIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { authClient } from "@/auth/client";

type AuthMode = "signin" | "signup";

const getAuthErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Authentication failed";
};

export const AuthForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "signin";
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);

    startTransition(async () => {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email,
              name: name.trim() || email,
              password,
            })
          : await authClient.signIn.email({
              email,
              password,
            });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      router.push("/");
      router.refresh();
    });
  };

  const signInWithGoogle = () => {
    setError(null);

    startTransition(async () => {
      const result = await authClient.signIn.social({
        callbackURL: "/",
        provider: "google",
      });

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Media CDN Service</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          onValueChange={(value) => {
            setMode(value as AuthMode);
            setError(null);
          }}
          value={mode}
        >
          <TabsList className="mb-5 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <Button
            className="mb-4 w-full"
            disabled={isPending}
            onClick={signInWithGoogle}
            variant="outline"
          >
            <GlobeIcon />
            Continue with Google
          </Button>

          <TabsContent className="space-y-4" value="signin">
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                autoComplete="email"
                id={emailId}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <Input
                autoComplete="current-password"
                id={passwordId}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <Button
              disabled={isPending || !(email.trim() && password)}
              onClick={submit}
            >
              <LogInIcon />
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </TabsContent>

          <TabsContent className="space-y-4" value="signup">
            <div className="space-y-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                autoComplete="name"
                id={nameId}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                autoComplete="email"
                id={emailId}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <Input
                autoComplete="new-password"
                id={passwordId}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <Button
              disabled={isPending || !(email.trim() && password)}
              onClick={submit}
            >
              <UserPlusIcon />
              {isPending ? "Creating..." : "Create account"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
