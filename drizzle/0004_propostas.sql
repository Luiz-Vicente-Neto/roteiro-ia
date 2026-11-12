CREATE TABLE "propostas" (
	"id" text PRIMARY KEY NOT NULL,
	"pacote" text NOT NULL,
	"data" date NOT NULL,
	"adultos" integer NOT NULL,
	"criancas" integer[] NOT NULL,
	"total" integer NOT NULL,
	"criada_em" timestamp with time zone NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	CONSTRAINT "propostas_ao_menos_um_adulto" CHECK ("propostas"."adultos" >= 1),
	CONSTRAINT "propostas_total_nao_negativo" CHECK ("propostas"."total" >= 0),
	CONSTRAINT "propostas_expira_depois_de_criada" CHECK ("propostas"."expira_em" > "propostas"."criada_em")
);
--> statement-breakpoint
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_pacote_data_saidas_pacote_data_fk" FOREIGN KEY ("pacote","data") REFERENCES "public"."saidas"("pacote","data") ON DELETE no action ON UPDATE no action;