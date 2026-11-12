CREATE TABLE "destinos" (
	"slug" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hoteis" (
	"slug" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"destino" text NOT NULL,
	"aceita_pet" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacotes" (
	"slug" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"hotel" text NOT NULL,
	"noites" integer NOT NULL,
	"inclui" text[] NOT NULL,
	CONSTRAINT "pacotes_noites_positivas" CHECK ("pacotes"."noites" > 0)
);
--> statement-breakpoint
CREATE TABLE "saidas" (
	"pacote" text NOT NULL,
	"data" date NOT NULL,
	"vagas_totais" integer NOT NULL,
	CONSTRAINT "saidas_pacote_data_pk" PRIMARY KEY("pacote","data"),
	CONSTRAINT "saidas_vagas_nao_negativas" CHECK ("saidas"."vagas_totais" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hoteis" ADD CONSTRAINT "hoteis_destino_destinos_slug_fk" FOREIGN KEY ("destino") REFERENCES "public"."destinos"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_hotel_hoteis_slug_fk" FOREIGN KEY ("hotel") REFERENCES "public"."hoteis"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saidas" ADD CONSTRAINT "saidas_pacote_pacotes_slug_fk" FOREIGN KEY ("pacote") REFERENCES "public"."pacotes"("slug") ON DELETE no action ON UPDATE no action;