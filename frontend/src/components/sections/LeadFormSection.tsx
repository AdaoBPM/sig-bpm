"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = "idle" | "submitting" | "success" | "error";

export function LeadFormSection() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get("nome") ?? ""),
      email: String(formData.get("email") ?? ""),
      empresa: String(formData.get("empresa") ?? "") || undefined,
      mensagem: String(formData.get("mensagem") ?? "") || undefined,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível enviar. Tente novamente.");
        setFormState("error");
        return;
      }

      event.currentTarget.reset();
      setFormState("success");
    } catch {
      setErrorMessage("Erro de conexão. Verifique a rede e tente novamente.");
      setFormState("error");
    }
  }

  return (
    <section id="contato" className="bg-neutral-100 py-16">
      <div className="mx-auto max-w-xl px-6">
        <h2 className="text-2xl font-bold text-bpm-secondary">Fale conosco</h2>
        <p className="mt-2 text-muted-foreground">
          Formulário de exemplo — envia para <code className="text-sm">POST /api/leads</code>{" "}
          (BFF no Next.js, sem backend Express).
        </p>

        {formState === "success" ? (
          <p
            className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-green-800"
            role="status"
          >
            Mensagem recebida. Em produção, configure o destino (e-mail, webhook ou CRM) no SPEC.
          </p>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa (opcional)</Label>
              <Input id="empresa" name="empresa" autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem (opcional)</Label>
              <textarea
                id="mensagem"
                name="mensagem"
                rows={4}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={formState === "submitting"}
              className="w-full bg-bpm-primary text-bpm-secondary hover:bg-bpm-primary-hover"
            >
              {formState === "submitting" ? "Enviando…" : "Enviar mensagem"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
