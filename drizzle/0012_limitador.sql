CREATE TABLE "contagens_do_limitador" (
	"chave" text NOT NULL,
	"inicio_da_janela" timestamp with time zone NOT NULL,
	"contagem" integer NOT NULL,
	CONSTRAINT "contagens_do_limitador_chave_inicio_da_janela_pk" PRIMARY KEY("chave","inicio_da_janela")
);
