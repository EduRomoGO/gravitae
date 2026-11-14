import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactElement } from "react";
import { AtomyModeProvider } from "@/components/shared/atomy-mode";
import { ReducedModeBand } from "@/components/shared/atomy-mode-controls";
import { SiteHeader } from "@/components/shared/site-header";
import { siteTitle } from "@/lib/page-title";
import "./globals.css";

// Self-hosted at build time, so every device draws the same letters and the
// layout does not depend on the fonts installed on the reader's system.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: siteTitle,
  description:
    "Aprende la ley de gravitación universal y explora soluciones periódicas del problema de los tres cuerpos.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">): ReactElement {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AtomyModeProvider>
          <SiteHeader />
          <ReducedModeBand />
          {children}
        </AtomyModeProvider>
      </body>
    </html>
  );
}
