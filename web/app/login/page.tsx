"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();

  // Prepopulate credentials in development mode
  const isDevelopment = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState(
    isDevelopment ? "oliversong7h@gmail.com" : "",
  );
  const [password, setPassword] = useState(isDevelopment ? "tangtang1" : "");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace("/inventory");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-lg font-semibold">Sign in</h1>
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <div className="text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
        <Button className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
