import Link from "next/link";

import { BpmLogo } from "@/components/layout/BpmLogo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroSectionProps = {
  id?: string;
};

export function HeroSection({ id = "inicio" }: HeroSectionProps) {
  return (
    <section id={id} className="bg-bpm-secondary text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16 md:flex-row md:items-center md:py-24">
        <div className="flex-1 space-y-6">
          <BpmLogo className="h-10 w-auto" priority />
          <p className="text-sm font-medium uppercase tracking-widest text-bpm-primary">
            Exemplo — landing page
          </p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            Peças pré-moldadas com precisão industrial
          </h1>
          <p className="max-w-xl text-lg text-neutral-300">
            Referência visual do molde BPM: página pública, sem login, com formulário de
            captação. Substitua este conteúdo após a entrevista e o SPEC.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#contato"
              className={cn(
                buttonVariants(),
                "bg-bpm-primary text-bpm-secondary hover:bg-bpm-primary-hover",
              )}
            >
              Solicitar orçamento
            </Link>
            <Link
              href="/auth/login"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-neutral-600 bg-transparent text-white hover:bg-neutral-800",
              )}
            >
              Acessar sistema interno
            </Link>
          </div>
        </div>
        <div className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-neutral-400">Entrega</dt>
              <dd className="text-xl font-semibold">Sob medida</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-400">Qualidade</dt>
              <dd className="text-xl font-semibold">Normas técnicas</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-400">Atendimento</dt>
              <dd className="text-xl font-semibold">Todo o Brasil</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-400">Suporte</dt>
              <dd className="text-xl font-semibold">Equipe BPM</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
