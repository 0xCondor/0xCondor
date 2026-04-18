import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condor EASM — Attack Surface Monitoring per MSP italiani",
  description:
    "La piattaforma di External Attack Surface Management white-label pensata per MSP italiani. Monitora l'esposizione dei tuoi clienti, produci report brandizzati in italiano e fattura un servizio ricorrente.",
  openGraph: {
    title: "Condor EASM",
    description: "Attack Surface Monitoring white-label per MSP italiani",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
