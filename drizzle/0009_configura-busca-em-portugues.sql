-- The word search of buscar_politicas (docs/adr/0005): Portuguese stems with
-- accents removed first, so "estacao" finds "estação". Created by migration,
-- like pgvector, so the same step runs locally, in CI and on Supabase.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- portuguese_stem checks its stopwords after unaccent, against an accented
-- list, so "não" would be indexed. This dictionary drops them first and,
-- with Accept = false, hands every other word on.
CREATE TEXT SEARCH DICTIONARY pt_palavras_vazias (
	TEMPLATE = simple, STOPWORDS = portuguese, ACCEPT = false
);--> statement-breakpoint
CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
	ALTER MAPPING FOR hword, hword_part, word
	WITH pt_palavras_vazias, unaccent, portuguese_stem;
