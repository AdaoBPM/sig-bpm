import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BPM Pré-Moldados — Exemplo Landing",
  description:
    "Página de referência do molde BPM: landing pública com hero, benefícios e formulário de leads.",
  openGraph: {
    title: "BPM Pré-Moldados",
    description: "Peças pré-moldadas com precisão industrial.",
    type: "website",
  },
};

export default function LandingExampleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
