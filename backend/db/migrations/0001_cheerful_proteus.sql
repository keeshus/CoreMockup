CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"thread" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"html" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
