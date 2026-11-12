# 🧭 Roteiro IA

> Um assistente de viagens que conversa como gente e responde com dados reais, sem inventar preço nenhum.

Você descreve a viagem que tem na cabeça:

> *"4 dias em Gramado em julho, casal, até R$ 6 mil"*

E o assistente devolve **pacotes reais de um catálogo**, com preço e disponibilidade consultados na hora e a fonte de cada informação.

> 🚧 **Em construção.** A etapa 1 (catálogo e ferramentas testadas) está pronta. O chat com IA é a próxima. Acompanhe no [roadmap](#-roadmap) abaixo.

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
| Modelo de linguagem | Claude API com *tool use* | 🔜 |
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

As ferramentas vivem num único módulo ([src/catalogo/](src/catalogo/)), sem dependência de Next.js nem do banco: ele fala com uma *base do catálogo* trocável (Postgres ou memória). O chat e o servidor MCP vão usar essa mesma lista, sem duplicação.

| Ferramenta | O que faz | Status |
| --- | --- | --- |
| `buscar_pacotes` | Encontra pacotes por grupo (adultos e idades das crianças), destino, janela de datas e orçamento total. Quando nada serve, explica o porquê (vagas, orçamento, política de crianças) | ✅ |
| `consultar_preco` | Calcula o preço de um pacote numa data de saída para um grupo, pessoa por pessoa, mostrando o período tarifário aplicado | ✅ |
| `verificar_disponibilidade` | Informa as vagas restantes de uma saída | ✅ |
| `propor_pre_reserva` | Prepara uma proposta de pré-reserva, válida por 15 minutos. **Não reserva nem bloqueia vagas** | ✅ |
| `buscar_politicas` | Busca semântica (RAG) em políticas, FAQs e descrições | 🔜 |

**Por que o modelo não confirma a reserva?** A confirmação não é uma ferramenta: só a pessoa confirma a proposta, por um caminho fora da conversa com o modelo. Ao confirmar, as vagas são bloqueadas de forma atômica no banco, então duas confirmações simultâneas nunca vendem a mesma vaga.

Entradas inválidas do modelo voltam como erro estruturado (com sugestões, como as saídas mais próximas), nunca como exceção.

---

## 💻 Rodando localmente

Pré-requisitos: Node 24, pnpm e Docker.

```bash
pnpm install
pnpm dev        # sobe o Postgres, aplica as migrations, roda o seed (se o banco estiver vazio) e inicia o Next
```

O `.env` é opcional: sem ele, o projeto usa o Postgres do `docker compose`. Para mudar a URL, copie o `.env.example` para `.env`.

| Comando | O que faz |
| --- | --- |
| `pnpm db:reset` | Recria o banco do zero e roda o seed |
| `pnpm db:generate` | Gera uma migration a partir do esquema do Drizzle |
| `pnpm lint` / `pnpm format` | Confere / corrige lint e formatação (Biome) |
| `pnpm typecheck` | Checa os tipos |
| `pnpm test` | Testes em memória |
| `pnpm test:db` | Testes contra o Postgres (num banco separado, com sufixo `_test`) |

O `pnpm install` instala um pre-commit ([lefthook.yml](lefthook.yml)) que roda lint nos arquivos staged, typecheck e os testes em memória. O CI roda tudo isso, os testes com Postgres e confere se cada mudança no `schema.ts` veio com a sua migration.

---

## 🗺️ Roadmap

- [x] **1. Catálogo:** modelagem dos dados, seed (40 pacotes em 7 destinos) e ferramentas testadas contra Postgres e memória
- [ ] **2. Agente:** chat com streaming chamando as ferramentas
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
