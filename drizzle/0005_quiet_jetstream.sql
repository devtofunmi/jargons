ALTER TABLE "workspace_settings" ADD COLUMN "custom_instructions" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "min_severity" "finding_severity" DEFAULT 'note' NOT NULL;