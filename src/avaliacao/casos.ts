import type { Caso, Casos } from "./caso";

/*
 * The Casos of the Avaliação, written by hand. Every expected value is
 * checked against semente.ts at `agora` by casos.test.ts, so a wrong Caso
 * fails there and never passes for a wrong model. Each Saída picked has
 * Vagas to spare for its Grupo.
 */

const casal = { adultos: 2, criancas: [] };

/** Período Tarifário: the right temporada or feriado, and the larger fator when two cover the Saída. */
const periodoTarifario: Caso[] = [
  {
    id: "preco-periodo-gramado-inverno",
    categoria: "preco",
    mensagem:
      "Quanto fica o Gramado Essencial no Serra Azul, de 3 noites, saindo no dia 10/07/2027, para um casal?",
    // Inverno na Serra, 1,35.
    esperado: {
      pacote: "gramado-serra-azul-3n",
      data: "2027-07-10",
      grupo: casal,
      total: 578000,
    },
  },
  {
    id: "preco-periodo-porto-carnaval",
    categoria: "preco",
    mensagem:
      "Qual o preço do Porto de Galinhas Essencial no Recife dos Corais com saída em 06/02/2027, no Carnaval? Somos 2 adultos.",
    // Alta de Verão (1,4) beats Carnaval (1,35).
    esperado: {
      pacote: "porto-de-galinhas-recife-dos-corais-4n",
      data: "2027-02-06",
      grupo: casal,
      total: 753200,
    },
  },
  {
    id: "preco-periodo-gramado-natal",
    categoria: "preco",
    mensagem:
      "Quero passar o Natal no Bavária Palace em Gramado: quanto custa o pacote de 3 noites saindo em 24/12/2027 para 2 adultos?",
    // Natal (1,35) beats Natal Luz (1,25).
    esperado: {
      pacote: "gramado-bavaria-palace-3n",
      data: "2027-12-24",
      grupo: casal,
      total: 780400,
    },
  },
  {
    id: "preco-periodo-bonito-baixa",
    categoria: "preco",
    mensagem:
      "Quanto custa o Bonito Essencial no Águas Cristalinas, saída em 13/03/2027, para mim e minha esposa?",
    // Baixa temporada.
    esperado: {
      pacote: "bonito-aguas-cristalinas-3n",
      data: "2027-03-13",
      grupo: casal,
      total: 490000,
    },
  },
  {
    id: "preco-periodo-campos-festival",
    categoria: "preco",
    mensagem:
      "Qual o valor do Campos do Jordão Clássico no Château da Montanha, 4 noites, saindo em 11/07/2027, para 2 adultos?",
    // Festival de Inverno (1,6) inside the Temporada de Inverno (1,4).
    esperado: {
      pacote: "campos-do-jordao-chateau-montanha-4n",
      data: "2027-07-11",
      grupo: casal,
      total: 764800,
    },
  },
  {
    id: "preco-periodo-jeri-ventos",
    categoria: "preco",
    mensagem:
      "Somos 3 amigos adultos. Quanto sai o pacote de 3 noites no Hotel Duna do Pôr do Sol, em Jericoacoara, saindo em 16/09/2027?",
    // Temporada dos Ventos, 1,15.
    esperado: {
      pacote: "jericoacoara-duna-do-por-do-sol-3n",
      data: "2027-09-16",
      grupo: { adultos: 3, criancas: [] },
      total: 790200,
    },
  },
];

/** Política de Crianças: free, discounted and adult-priced children, in both kinds of Política. */
const politicaDeCriancas: Caso[] = [
  {
    id: "preco-criancas-gramado-gratis-e-metade",
    categoria: "preco",
    mensagem:
      "Quanto custa o Gramado Essencial no Serra Azul saindo em 13/03/2027 para 2 adultos e 2 crianças, de 4 e 8 anos?",
    // 4 free, 8 pays half.
    esperado: {
      pacote: "gramado-serra-azul-3n",
      data: "2027-03-13",
      grupo: { adultos: 2, criancas: [4, 8] },
      total: 535300,
    },
  },
  {
    id: "preco-criancas-campos-bebe",
    categoria: "preco",
    mensagem:
      "Quanto fica a Semana na Mantiqueira no Recanto das Araucárias, saída em 15/05/2027, para um casal com um bebê de 1 ano e uma criança de 5?",
    // Only the baby is free; 5 pays 70 %.
    esperado: {
      pacote: "campos-do-jordao-recanto-das-araucarias-7n",
      data: "2027-05-15",
      grupo: { adultos: 2, criancas: [1, 5] },
      total: 1050300,
    },
  },
  {
    id: "preco-criancas-foz-doze-anos",
    categoria: "preco",
    mensagem:
      "Qual o preço do Foz Essencial no Cataratas Park saindo em 09/04/2027 para 2 adultos e meus filhos de 6 e 12 anos?",
    // 6 pays half; 12 pays as an adult.
    esperado: {
      pacote: "foz-do-iguacu-cataratas-park-3n",
      data: "2027-04-09",
      grupo: { adultos: 2, criancas: [6, 12] },
      total: 661500,
    },
  },
  {
    id: "preco-criancas-foz-onze-anos",
    categoria: "preco",
    mensagem:
      "Quanto custa o Foz em Família no Três Fronteiras, saída em 21/03/2027, para 2 adultos e uma criança de 11 anos?",
    // 11 is the last age of the 70 % faixa.
    esperado: {
      pacote: "foz-do-iguacu-tres-fronteiras-5n",
      data: "2027-03-21",
      grupo: { adultos: 2, criancas: [11] },
      total: 699300,
    },
  },
];

/** Orçamento: only one Pacote fits the budget for the Grupo in the window. */
const orcamento: Caso[] = [
  {
    id: "preco-orcamento-bonito-marco",
    categoria: "preco",
    mensagem:
      "Somos um casal e queremos ir para Bonito em março de 2027 gastando no máximo R$ 5.200 no total. O que vocês têm?",
    esperado: {
      pacote: "bonito-aguas-cristalinas-3n",
      data: "2027-03-06",
      grupo: casal,
      total: 490000,
      busca: {
        destino: "Bonito",
        janela: { inicio: "2027-03-01", fim: "2027-03-31" },
        orcamento: 520000,
        grupo: casal,
      },
    },
  },
  {
    id: "preco-orcamento-foz-maio",
    categoria: "preco",
    mensagem:
      "Quero levar minha família para Foz do Iguaçu em maio de 2027: 2 adultos e uma criança de 3 anos, até R$ 4.000 no total. Tem algo?",
    esperado: {
      pacote: "foz-do-iguacu-cataratas-park-3n",
      data: "2027-05-07",
      grupo: { adultos: 2, criancas: [3] },
      total: 378000,
      busca: {
        destino: "Foz do Iguaçu",
        janela: { inicio: "2027-05-01", fim: "2027-05-31" },
        orcamento: 400000,
        grupo: { adultos: 2, criancas: [3] },
      },
    },
  },
  {
    id: "preco-orcamento-gramado-julho",
    categoria: "preco",
    mensagem:
      "Um casal quer ir a Gramado em julho de 2027 com até R$ 5.000 para a viagem toda. Que opção cabe?",
    esperado: {
      pacote: "gramado-vale-das-hortensias-2n",
      data: "2027-07-02",
      grupo: casal,
      total: 402400,
      busca: {
        destino: "Gramado",
        janela: { inicio: "2027-07-01", fim: "2027-07-31" },
        orcamento: 500000,
        grupo: casal,
      },
    },
  },
];

/** Nenhum Pacote serve: the budget is below every Saída the Grupo could take. */
const nenhumPacote: Caso[] = [
  {
    id: "preco-nenhum-jeri-janeiro",
    categoria: "preco",
    mensagem:
      "Somos um casal e queremos ir para Jericoacoara em janeiro de 2027 gastando até R$ 3.000 no total. Tem algum pacote?",
    esperado: {
      nenhumPacote: true,
      busca: {
        destino: "Jericoacoara",
        janela: { inicio: "2027-01-01", fim: "2027-01-31" },
        orcamento: 300000,
        grupo: casal,
      },
    },
  },
  {
    id: "preco-nenhum-lencois-familia",
    categoria: "preco",
    mensagem:
      "Família com 2 adultos e 3 crianças (2, 5 e 8 anos) quer ir aos Lençóis Maranhenses em julho de 2027, com até R$ 4.000 no total. Algum pacote serve?",
    esperado: {
      nenhumPacote: true,
      busca: {
        destino: "Lençóis Maranhenses",
        janela: { inicio: "2027-07-01", fim: "2027-07-31" },
        orcamento: 400000,
        grupo: { adultos: 2, criancas: [2, 5, 8] },
      },
    },
  },
];

export const CASOS: Casos = {
  // Every Saída of the seed is in 2027, so all of them are still ahead.
  agora: "2026-12-01T09:00:00-03:00",
  lista: [
    ...periodoTarifario,
    ...politicaDeCriancas,
    ...orcamento,
    ...nenhumPacote,
  ],
};
