"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail"),
  password: z.string().min(1, "Passwort erforderlich"),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(1, "Name erforderlich"),
  household_name: z.string().min(1, "Haushaltsname erforderlich"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  async function onLogin(data: LoginForm) {
    setError(null);
    try {
      await apiFetch("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Login");
    }
  }

  async function onRegister(data: RegisterForm) {
    setError(null);
    try {
      await apiFetch("/api/v1/auth/register", { method: "POST", body: JSON.stringify(data) });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler bei der Registrierung");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {mode === "login" ? "Anmelden" : "Registrieren"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "login" ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" {...loginForm.register("email")} />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Passwort</Label>
                <Input id="password" type="password" {...loginForm.register("password")} />
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? "Lädt…" : "Anmelden"}
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...registerForm.register("name")} />
                {registerForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="household">Haushaltsname</Label>
                <Input id="household" placeholder="z.B. Familie Müller" {...registerForm.register("household_name")} />
                {registerForm.formState.errors.household_name && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.household_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-email">E-Mail</Label>
                <Input id="reg-email" type="email" {...registerForm.register("email")} />
                {registerForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-password">Passwort</Label>
                <Input id="reg-password" type="password" {...registerForm.register("password")} />
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                {registerForm.formState.isSubmitting ? "Lädt…" : "Konto erstellen"}
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          >
            {mode === "login" ? "Noch kein Konto? Registrieren" : "Bereits registriert? Anmelden"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
