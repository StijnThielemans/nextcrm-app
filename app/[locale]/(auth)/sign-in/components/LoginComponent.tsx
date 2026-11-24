"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/auth-client";

import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailIcon } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = "email" | "otp";

export function LoginComponent({ passwordSignIn = false }: { passwordSignIn?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      toast.error("Aanmelden met Google is mislukt.");
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithPassword = async () => {
    if (!email || !password) {
      toast.error("Vul je e-mailadres en wachtwoord in.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });
      if (error) {
        toast.error("E-mail of wachtwoord klopt niet.");
        return;
      }
      toast.success("Je bent aangemeld.");
      const locale = window.location.pathname.split("/").filter(Boolean)[0];
      window.location.href = locale ? `/${locale}` : "/";
    } catch {
      toast.error("Aanmelden is mislukt.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email) {
      toast.error("Vul je e-mailadres in.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (error) {
        toast.error(error.message || "De code kon niet worden verstuurd.");
        return;
      }
      setStep("otp");
      toast.success("De code staat in je mailbox.");
    } catch (error) {
      toast.error("De code kon niet worden verstuurd.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Vul de code van 6 cijfers in.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp,
      });
      if (error) {
        toast.error(error.message || "De code is ongeldig of verlopen.");
        return;
      }
      toast.success("Je bent aangemeld.");
      window.location.href = new URL("/", window.location.origin).href;
    } catch (error) {
      toast.error("De code klopt niet.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-[hsl(215_16%_76%)] shadow-none">
      <CardHeader className="space-y-1 border-b border-[hsl(215_14%_86%)]">
        <CardTitle className="text-2xl font-bold">Aanmelden</CardTitle>
        <CardDescription>
          {passwordSignIn ? "Meld je aan met e-mail en wachtwoord" : "Kies hoe je wil aanmelden"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6">
        <div className="rounded-lg border border-[hsl(215_14%_84%)] p-3">
          <Button
            variant="outline"
            onClick={loginWithGoogle}
            disabled={isLoading}
            className="w-full"
          >
            <Icons.google className="mr-2 h-4 w-4" />
            Doorgaan met Google
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[hsl(215_14%_82%)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">
              of met e-mail
            </span>
          </div>
        </div>

        {passwordSignIn && (
          <form
            className="grid gap-3 rounded-lg border border-[hsl(215_14%_84%)] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void signInWithPassword();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={isLoading || !email || !password}>
              Aanmelden
            </Button>
          </form>
        )}

        {!passwordSignIn && step === "email" && (
          <div className="grid gap-3 rounded-lg border border-[hsl(215_14%_84%)] p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              />
            </div>
            <Button onClick={sendOtp} disabled={isLoading || !email}>
              <MailIcon className="mr-2 h-4 w-4" />
              Code versturen
            </Button>
          </div>
        )}

        {!passwordSignIn && step === "otp" && (
          <div className="grid gap-3 rounded-lg border border-[hsl(215_14%_84%)] p-3">
            <p className="text-sm text-muted-foreground">
              Vul de code van 6 cijfers in die we stuurden naar <strong>{email}</strong>
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={verifyOtp} disabled={isLoading || otp.length !== 6}>
              Bevestigen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("email");
                setOtp("");
              }}
              disabled={isLoading}
            >
              Ander e-mailadres
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
