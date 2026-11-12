CREATE TABLE "pre_reservas" (
	"codigo" text PRIMARY KEY NOT NULL,
	"pacote" text NOT NULL,
	"data" date NOT NULL,
	"adultos" integer NOT NULL,
	"criancas" integer[] NOT NULL,
	"total" integer NOT NULL,
	"criada_em" timestamp with time zone NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	CONSTRAINT "pre_reservas_ao_menos_um_adulto" CHECK ("pre_reservas"."adultos" >= 1),
	CONSTRAINT "pre_reservas_total_nao_negativo" CHECK ("pre_reservas"."total" >= 0),
	CONSTRAINT "pre_reservas_expira_depois_de_criada" CHECK ("pre_reservas"."expira_em" > "pre_reservas"."criada_em")
);
--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "confirmada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pre_reservas" ADD CONSTRAINT "pre_reservas_pacote_data_saidas_pacote_data_fk" FOREIGN KEY ("pacote","data") REFERENCES "public"."saidas"("pacote","data") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pre_reservas_saida_idx" ON "pre_reservas" USING btree ("pacote","data","expira_em");