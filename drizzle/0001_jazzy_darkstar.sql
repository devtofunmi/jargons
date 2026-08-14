CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"country" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_views_created_at_idx" ON "page_views" USING btree ("created_at");
CREATE INDEX "page_views_path_idx" ON "page_views" USING btree ("path");
CREATE INDEX "page_views_country_idx" ON "page_views" USING btree ("country");
CREATE INDEX "page_views_referrer_idx" ON "page_views" USING btree ("referrer");