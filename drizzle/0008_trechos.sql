CREATE TABLE "trechos" (
	"id" text PRIMARY KEY NOT NULL,
	"documento_id" text NOT NULL,
	"documento_titulo" text NOT NULL,
	"tipo_do_documento" text NOT NULL,
	"secao" text NOT NULL,
	"texto_citado" text NOT NULL,
	"texto_embedado" text NOT NULL,
	"hash" text NOT NULL,
	"modelo" text NOT NULL,
	"vetor" vector(768) NOT NULL
);
