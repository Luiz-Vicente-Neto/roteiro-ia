# 🧭 Roteiro IA

> Um assistente de viagens que conversa como gente e responde com dados reais, sem inventar preço nenhum.

Você descreve a viagem que tem na cabeça:

> *"4 dias em Gramado em julho, casal, até R$ 6 mil"*

E o assistente devolve **pacotes reais de um catálogo**, com preço e disponibilidade consultados na hora e a fonte de cada informação.

> 🚧 **Em construção.** As etapas 1 (catálogo e ferramentas testadas) e 2 (chat com o Assistente) estão prontas. A busca semântica com citações (RAG) é a próxima. Acompanhe no [roadmap](#-roadmap) abaixo.

---

## ✨ O que torna este projeto diferente

A maioria dos chatbots com IA responde de memória e, às vezes, inventa. O Roteiro IA foi pensado para fazer o contrário:

- **🔧 O modelo não chuta preço.** Ele chama ferramentas para buscar pacotes, consultar preços por data e verificar vagas.
- **📚 Toda resposta cita a fonte.** Políticas, regras e descrições vêm de uma busca semântica (RAG), e o trecho usado aparece junto da resposta.
- **🔍 Transparência total.** Um painel *"como cheguei nessa resposta"* mostra cada ferramenta chamada e cada fonte consultada.
- **📏 Qualidade medida, não prometida.** Um conjunto de perguntas de avaliação roda no CI a cada mudança, e os resultados ficam publicados aqui.
- **🔌 Aberto via MCP.** As mesmas ferramentas ficam expostas como servidor MCP, para qualquer cliente compatível (Claude Desktop, Claude Code) consultar o catálogo.
- **🛡️ Seguro por padrão.** Recusa assuntos fora do escopo, admite quando não sabe, resiste a prompt injection e só faz pré-reserva com confirmação explícita.

---

## 🧱 Stack

| Camada | Tecnologia | Status |
| --- | --- | --- |
| Front-end e back-end | Next.js · TypeScript · Tailwind CSS | ✅ |
| Banco de dados | Postgres + pgvector (`docker compose` local) · Drizzle ORM | ✅ |
| Qualidade | Vitest · Biome · pre-commit (Lefthook) · GitHub Actions | ✅ |
| Modelo de linguagem | Vercel AI SDK com *tool use* e streaming · provedor trocável no `.env` (Gemini, Claude, GPT ou Grok) | ✅ |
| Integração externa | Servidor MCP (SDK oficial em TypeScript) | 🔜 |
| Deploy | Vercel + Supabase | 🔜 |

---

## 🗂️ O catálogo

Um catálogo fictício, escrito à mão e determinístico (nenhuma linha gerada por IA), com saídas semanais ao longo de 2027:

- **7 destinos:** Gramado, Campos do Jordão, Bonito, Foz do Iguaçu, Porto de Galinhas, Jericoacoara e Lençóis Maranhenses;
- **19 hotéis** e **40 pacotes**;
- **Períodos tarifários** (alta temporada, feriados) que ajustam o preço da baixa temporada, com regra clara de qual vence quando dois cobrem a mesma data;
- **Política de crianças** por pacote: faixas de idade com percentual do preço de adulto, ou pacotes que não aceitam crianças;
- **Vagas por saída**, incluindo saídas quase lotadas para testar os casos de borda.

O mesmo catálogo alimenta o Postgres (pelo seed) e uma base em memória usada nos testes, então os dois têm sempre exatamente os mesmos dados.

---

## 🛠️ Ferramentas do agente

As ferramentas vivem num único módulo ([src/catalogo/](src/catalogo/)), sem dependência de Next.js nem do banco: ele fala com uma *base do catálogo* trocável (Postgres ou memória). O chat já usa essa lista, e o servidor MCP vai usar a mesma, sem duplicação.

| Ferramenta | O que faz | Status |
| --- | --- | --- |
| `buscar_pacotes` | Encontra pacotes por grupo (adultos e idades das crianças), destino, janela de datas e orçamento total. Quando nada serve, explica o porquê (vagas, orçamento, política de crianças) | ✅ |
| `consultar_preco` | Calcula o preço de um pacote numa data de saída para um grupo, pessoa por pessoa, mostrando o período tarifário aplicado | ✅ |
| `verificar_disponibilidade` | Informa as vagas restantes de uma saída | ✅ |
| `propor_pre_reserva` | Prepara uma proposta de pré-reserva, válida por 15 minutos. **Não reserva nem bloqueia vagas** | ✅ |
| `buscar_politicas` | Busca semântica (RAG) em políticas, FAQs e descrições | 🔜 |

**Por que o modelo não confirma a reserva?** A confirmação não é uma ferramenta: só a pessoa confirma a proposta, clicando no botão do card, por um caminho que não passa pelo modelo. Ao confirmar, as vagas são bloqueadas de forma atômica no banco, então duas confirmações simultâneas nunca vendem a mesma vaga.

Entradas inválidas do modelo voltam como erro estruturado (com sugestões, como as saídas mais próximas), nunca como exceção.

---

## 💬 O chat

O Assistente ([src/assistente/](src/assistente/)) conversa em streaming e só afirma preço, vagas e datas que uma ferramenta devolveu naquela conversa. Como o catálogo, é um módulo sem Next.js nem banco dentro: recebe o modelo, o catálogo, uma *base de conversas* (Postgres ou memória) e um relógio.

- **Cards a partir dos dados, não do texto.** Cada cotação vira um card com a foto do destino, o hotel, as noites, a data de saída, o total e as vagas restantes. Os valores vêm do resultado da ferramenta e nunca são reescritos pelo modelo.
- **Painel "como cheguei nessa resposta".** Cada resposta lista, em ordem, as ferramentas chamadas, com a entrada e a saída bruta de cada uma.
- **Pré-reserva só com o seu clique.** O Assistente prepara uma proposta, e o card mostra os botões **Confirmar pré-reserva** e **Descartar**. Depois do clique, o card mostra o código da pré-reserva e até quando as vagas ficam bloqueadas.
- **Ninguém forja uma confirmação.** O que você faz no card chega ao modelo como um evento do sistema, com um marcador que é removido de qualquer texto digitado na conversa.
- **Histórico sem login.** As conversas ficam salvas e listadas na barra lateral, ligadas a um id anônimo num cookie. O link de uma conversa não abre em outro navegador, e conversas paradas há mais de 90 dias são apagadas.
- **Limites claros.** No máximo 6 passos de ferramenta por resposta e 40 mensagens por conversa. Se o provedor de IA falhar, você vê um aviso amigável e a sua mensagem continua salva.
- **Modelo trocável.** O provedor é escolhido no `.env` como `MODELO=provedor:modelo`. O padrão é o Gemini Flash, no plano gratuito do Google AI Studio, e um provedor desconhecido ou uma chave ausente dá erro na inicialização, em vez de cair em outro provedor.

Os testes do Assistente usam um modelo falso com respostas roteirizadas, então rodam sem chave de provedor e sem rede.

---

## 💻 Rodando localmente

Pré-requisitos: Node 24, pnpm, Docker e a chave de um provedor de IA (a do [Google AI Studio](https://aistudio.google.com/apikey) é gratuita).

```bash
pnpm install
cp .env.example .env   # preencha GOOGLE_GENERATIVE_AI_API_KEY, ou troque MODELO e a chave por outro provedor
pnpm dev               # sobe o Postgres, aplica as migrations, roda o seed (se o banco estiver vazio) e inicia o Next
```

Abra <http://localhost:3000> e converse. O `.env.example` traz um exemplo de `MODELO` para cada provedor. Os testes não precisam de chave nem de `.env`: sem ele, usam o Postgres do `docker compose`.

> No plano gratuito do Gemini, o Google pode usar as mensagens para melhorar os produtos dele. Por isso o chat avisa que as mensagens vão para um provedor de IA.

| Comando | O que faz |
| --- | --- |
| `pnpm db:reset` | Recria o banco do zero e roda o seed |
| `pnpm db:generate` | Gera uma migration a partir do esquema do Drizzle |
| `pnpm lint` / `pnpm format` | Confere / corrige lint e formatação (Biome) |
| `pnpm typecheck` | Checa os tipos |
| `pnpm test` | Testes em memória |
| `pnpm test:db` | Testes contra o Postgres (num banco separado, com sufixo `_test`) |
| `pnpm build` | Build de produção do Next |

O `pnpm install` instala um pre-commit ([lefthook.yml](lefthook.yml)) que roda lint nos arquivos staged, typecheck e os testes em memória. O CI roda tudo isso, o build do Next, os testes com Postgres e confere se cada mudança no `schema.ts` veio com a sua migration.

---

## 🗺️ Roadmap

- [x] **1. Catálogo:** modelagem dos dados, seed (40 pacotes em 7 destinos) e ferramentas testadas contra Postgres e memória
- [x] **2. Agente:** chat com streaming chamando as ferramentas, cards de cotação, pré-reserva confirmada por botão e histórico de conversas
- [ ] **3. RAG:** busca híbrida com citações de fonte
- [ ] **4. Avaliação e proteções:** suíte de perguntas, métricas no CI, rate limit e testes de prompt injection
- [ ] **5. Servidor MCP:** ferramentas expostas com permissões mínimas
- [ ] **6. Lançamento:** README completo, GIF da demo, diagrama de arquitetura e deploy público

---

## 📊 Avaliação

*Em breve:* uma tabela com os resultados da suíte de avaliação (acerto de preço, citação de fonte e recusa correta) gerada automaticamente a cada mudança.

---

<p align="center">
  Feito com ☕ e curiosidade por <strong>Luiz Vitor</strong>
</p>
