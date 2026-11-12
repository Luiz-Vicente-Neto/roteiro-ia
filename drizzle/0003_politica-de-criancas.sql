CREATE TABLE "faixas_de_criancas" (
	"pacote" text NOT NULL,
	"idade_minima" integer NOT NULL,
	"idade_maxima" integer NOT NULL,
	"percentual" integer NOT NULL,
	CONSTRAINT "faixas_de_criancas_pacote_idade_minima_pk" PRIMARY KEY("pacote","idade_minima"),
	CONSTRAINT "faixas_de_criancas_idades_de_crianca" CHECK (0 <= "faixas_de_criancas"."idade_minima" and "faixas_de_criancas"."idade_minima" <= "faixas_de_criancas"."idade_maxima" and "faixas_de_criancas"."idade_maxima" <= 11),
	CONSTRAINT "faixas_de_criancas_percentual_valido" CHECK ("faixas_de_criancas"."percentual" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "pacotes" ADD COLUMN "aceita_criancas" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "faixas_de_criancas" ADD CONSTRAINT "faixas_de_criancas_pacote_pacotes_slug_fk" FOREIGN KEY ("pacote") REFERENCES "public"."pacotes"("slug") ON DELETE no action ON UPDATE no action;