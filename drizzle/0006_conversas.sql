CREATE TABLE "conversas" (
	"id" text PRIMARY KEY NOT NULL,
	"dono" text NOT NULL,
	"titulo" text DEFAULT '' NOT NULL,
	"criada_em" timestamp with time zone NOT NULL,
	"ultima_atividade" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_de_conversa" (
	"posicao" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "itens_de_conversa_posicao_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversa" text NOT NULL,
	"tipo" text NOT NULL,
	"id" text NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"conteudo" jsonb NOT NULL,
	CONSTRAINT "itens_de_conversa_tipo_valido" CHECK ("itens_de_conversa"."tipo" in ('mensagem', 'evento'))
);
--> statement-breakpoint
ALTER TABLE "itens_de_conversa" ADD CONSTRAINT "itens_de_conversa_conversa_conversas_id_fk" FOREIGN KEY ("conversa") REFERENCES "public"."conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversas_dono_idx" ON "conversas" USING btree ("dono","ultima_atividade");--> statement-breakpoint
CREATE INDEX "itens_de_conversa_conversa_idx" ON "itens_de_conversa" USING btree ("conversa","posicao");