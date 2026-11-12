import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roteiro IA",
  description:
    "Assistente de viagens que responde com pacotes de um catálogo, com preço e disponibilidade consultados na hora.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
