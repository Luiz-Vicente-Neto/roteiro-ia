CREATE TABLE "periodos_tarifarios" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "periodos_tarifarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"destino" text,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"fator" numeric(4, 2) NOT NULL,
	CONSTRAINT "periodos_tarifarios_tipo_valido" CHECK ("periodos_tarifarios"."tipo" in ('temporada', 'feriado')),
	CONSTRAINT "periodos_tarifarios_destino_so_na_temporada" CHECK (("periodos_tarifarios"."tipo" = 'temporada') = ("periodos_tarifarios"."destino" is not null)),
	CONSTRAINT "periodos_tarifarios_fim_depois_do_inicio" CHECK ("periodos_tarifarios"."fim" >= "periodos_tarifarios"."inicio"),
	CONSTRAINT "periodos_tarifarios_fator_positivo" CHECK ("periodos_tarifarios"."fator" > 0)
);
--> statement-breakpoint
ALTER TABLE "pacotes" ADD COLUMN "preco_base" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "periodos_tarifarios" ADD CONSTRAINT "periodos_tarifarios_destino_destinos_slug_fk" FOREIGN KEY ("destino") REFERENCES "public"."destinos"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_preco_base_em_reais_inteiros" CHECK ("pacotes"."preco_base" > 0 and "pacotes"."preco_base" % 100 = 0);