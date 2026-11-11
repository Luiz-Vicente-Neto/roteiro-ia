# 🧭 Roteiro IA

> Um assistente de viagens que conversa como gente e responde com dados reais, sem inventar preço nenhum.

Você descreve a viagem que tem na cabeça:

> *"4 dias em Gramado em julho, casal, até R$ 4 mil"*

E o assistente devolve **pacotes reais de um catálogo**, com preço e disponibilidade consultados na hora e a fonte de cada informação.

> 🚧 **Em construção.** Este repositório está nascendo agora. Acompanhe o progresso no [roadmap](#-roadmap) abaixo.

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

## 🧱 Stack planejada

| Camada | Tecnologia |
| --- | --- |
| Front-end e back-end | Next.js · TypeScript · Tailwind CSS |
| Banco de dados | Postgres (Supabase) + pgvector |
| Modelo de linguagem | Claude API com *tool use* |
| Integração externa | Servidor MCP (SDK oficial em TypeScript) |
| Deploy | Vercel |
| Qualidade | Testes automatizados + GitHub Actions |

---

## 🛠️ Ferramentas do agente

| Ferramenta | O que faz |
| --- | --- |
| `buscar_pacotes` | Encontra pacotes por destino, datas, número de pessoas e orçamento |
| `consultar_preco` | Calcula o preço de um pacote para uma data e quantidade de pessoas |
| `verificar_disponibilidade` | Confere as vagas de uma data de saída |
| `buscar_politicas` | Busca semântica (RAG) em políticas, FAQs e descrições |
| `criar_pre_reserva` | Cria uma pré-reserva, **sempre com confirmação da pessoa antes** |

---

## 🗺️ Roadmap

- [ ] **1. Catálogo:** modelagem dos dados, script de seed (30–50 pacotes em 6–8 destinos) e ferramentas testadas
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
