import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarraLateral } from "./barra-lateral";
import { donoDaVisita, obterAssistente } from "./servidor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roteiro IA",
  description:
    "Assistente de viagens que responde com pacotes de um catálogo, com preço e disponibilidade consultados na hora.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const dono = await donoDaVisita();
  const conversas = dono
    ? await obterAssistente().listarConversas({ dono })
    : [];
  return (
    <html lang="pt-BR">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <div className="md:flex">
          <BarraLateral conversas={conversas} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
