import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { SCRIPT_DO_TEMA } from "@/lib/temaScript";
import { Providers } from "@/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BPM — Sistema Interno",
  description: "Template de aplicações internas BPM Pré-Moldados",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // O tema (13/10/2026) vai no <html> antes da hidratação: suppressHydrationWarning no atributo.
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
