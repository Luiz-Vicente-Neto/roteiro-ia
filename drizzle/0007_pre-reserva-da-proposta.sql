ALTER TABLE "pre_reservas" ADD COLUMN "proposta" text;--> statement-breakpoint
ALTER TABLE "pre_reservas" ADD CONSTRAINT "pre_reservas_proposta_propostas_id_fk" FOREIGN KEY ("proposta") REFERENCES "public"."propostas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_reservas" ADD CONSTRAINT "pre_reservas_proposta_unique" UNIQUE("proposta");