import { Cabecalho } from "./cabecalho";
import { Conversa } from "./conversa";

/** A new Conversa: it gets its link once the first message is sent. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <Cabecalho />
      <Conversa />
    </main>
  );
}
