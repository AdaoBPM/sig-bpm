"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  metaDiariaSchema,
  type MetaDiariaInput,
} from "@/lib/schemas/metaDiariaSchema";

export function MetaDiariaForm() {
  const form = useForm<MetaDiariaInput>({
    resolver: zodResolver(metaDiariaSchema),
    defaultValues: {
      data: "",
      turno: "manha",
      observacao: "",
    },
  });

  useEffect(() => {
    form.setValue("data", new Date().toISOString().slice(0, 10));
  }, [form]);

  function onSubmit(values: MetaDiariaInput) {
    toast.success(
      `Lançamento mock: ${values.quantidade} un. — turno ${values.turno}`,
    );
    form.reset({
      data: values.data,
      turno: values.turno,
      observacao: "",
    });
  }

  return (
    <form
      className="max-w-md space-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={!!form.formState.errors.data}>
          <FieldLabel htmlFor="data">Data</FieldLabel>
          <Input id="data" type="date" {...form.register("data")} />
          <FieldError errors={[form.formState.errors.data]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.turno}>
          <FieldLabel htmlFor="turno">Turno</FieldLabel>
          <select
            id="turno"
            className="border-input bg-background h-9 w-full rounded-sm border px-3 text-sm"
            {...form.register("turno")}
          >
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </select>
          <FieldError errors={[form.formState.errors.turno]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.quantidade}>
          <FieldLabel htmlFor="quantidade">Quantidade produzida</FieldLabel>
          <Input
            id="quantidade"
            type="number"
            min={1}
            placeholder="Ex.: 120"
            {...form.register("quantidade", { valueAsNumber: true })}
          />
          <FieldDescription>Unidades do turno — mock, sem persistência.</FieldDescription>
          <FieldError errors={[form.formState.errors.quantidade]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.observacao}>
          <FieldLabel htmlFor="observacao">Observação (opcional)</FieldLabel>
          <Input
            id="observacao"
            placeholder="Ex.: parada programada 30 min"
            {...form.register("observacao")}
          />
          <FieldError errors={[form.formState.errors.observacao]} />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="bg-bpm-primary text-bpm-secondary hover:bg-bpm-primary-hover"
      >
        {form.formState.isSubmitting ? "Salvando…" : "Salvar lançamento (mock)"}
      </Button>
    </form>
  );
}
