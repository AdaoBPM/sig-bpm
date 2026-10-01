"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BpmLogo } from "@/components/layout/BpmLogo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { getSafeInternalPath } from "@/lib/navigation";

const isDev = process.env.NODE_ENV === "development";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState(isDev ? "admin@bpm.com" : "");
  const [password, setPassword] = useState(isDev ? "admin123" : "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      const redirectTo = getSafeInternalPath(searchParams.get("from"));
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-black/10 shadow-sm">
      <CardHeader className="items-center text-center">
        <BpmLogo className="h-10 w-auto" priority />
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Acesso ao sistema interno BPM</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex-col gap-3 border-t-0 bg-transparent pt-0">
          <Button type="submit" disabled={isSubmitting} className="w-full font-semibold">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
          {isDev ? (
            <p className="text-center text-xs text-muted-foreground">
              Dev: admin@bpm.com / admin123
            </p>
          ) : null}
        </CardFooter>
      </form>
    </Card>
  );
}
