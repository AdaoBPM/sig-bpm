import { BenefitsSection } from "@/components/sections/BenefitsSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { LeadFormSection } from "@/components/sections/LeadFormSection";

/**
 * Referência de landing page pública — ver Docs/stack/CONVENTIONS.md § landing page.
 * Rota pública (sem auth). Em projetos reais, a home (`app/page.tsx`) costuma ser esta página.
 */
export default function LandingExamplePage() {
  return (
    <main>
      <HeroSection />
      <BenefitsSection />
      <LeadFormSection />
      <footer className="border-t border-border bg-white py-8 text-center text-sm text-muted-foreground">
        © BPM Pré-Moldados — exemplo do template
      </footer>
    </main>
  );
}
