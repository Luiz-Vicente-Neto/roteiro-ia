// Pre-commit (lefthook.yml): no public file may name a local-only file. The
// names come from .git/info/exclude at run time, so this file names none of
// them. Without that list (CI, a fresh clone) there is nothing to check.
// `--todos` checks every tracked file instead of the staged ones.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });
}

const exclude = git("rev-parse", "--git-path", "info/exclude").trim();
if (!existsSync(exclude)) process.exit(0);

const nomes = readFileSync(exclude, "utf8")
  .split(/\r?\n/)
  .map((linha) => linha.replace(/^﻿/, "").trim())
  .filter((linha) => linha && !linha.startsWith("#") && !linha.startsWith("!"));
if (nomes.length === 0) process.exit(0);

// A name counts only as a path of its own, in a sentence or a link, never
// as the tail of a longer path or URL (a site's `/docs/` page).
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const padroes = nomes.map((nome) => ({
  nome,
  regex: new RegExp(
    `(^|[\\s"'\`(\\[<]|\\./)${escapar(nome)}${nome.endsWith("/") ? "" : "(?![\\w.-])"}`,
    "m",
  ),
}));

// The one allowed exception: citing an ADR by its number (`docs/adr/0003`),
// as code comments do to point at the decision behind them.
const CITACAO_DE_ADR = /docs\/adr\/\d{4}[\w.-]*/g;

const todos = process.argv.includes("--todos");
const arquivos = (
  todos
    ? git("ls-files")
    : git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
)
  .split("\n")
  .filter(Boolean);

const achados = [];
for (const arquivo of arquivos) {
  // The staged content, which is what the commit will hold.
  const conteudo = todos
    ? readFileSync(arquivo, "utf8")
    : git("show", `:${arquivo}`);
  if (conteudo.includes("\0")) continue;
  const linhas = conteudo
    .split("\n")
    .map((linha) => linha.replace(CITACAO_DE_ADR, ""));
  for (const { nome, regex } of padroes) {
    linhas.forEach((linha, i) => {
      if (regex.test(linha)) achados.push(`${arquivo}:${i + 1}: ${nome}`);
    });
  }
}

if (achados.length > 0) {
  console.error(
    "Arquivo público citando um arquivo só local (.git/info/exclude):\n" +
      achados.map((a) => `  ${a}`).join("\n") +
      "\nDescreva sem o nome do arquivo.",
  );
  process.exit(1);
}
