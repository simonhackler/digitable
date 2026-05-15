CREATE TABLE "policy_version" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_type" text NOT NULL,
	"version" text NOT NULL,
	"content_sha256" text NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_policy_acceptance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"policy_version_id" text NOT NULL,
	"action" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_policy_acceptance" ADD CONSTRAINT "user_policy_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_policy_acceptance" ADD CONSTRAINT "user_policy_acceptance_policy_version_id_policy_version_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_version"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policy_version_type_version_idx" ON "policy_version" USING btree ("policy_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_version_type_hash_idx" ON "policy_version" USING btree ("policy_type","content_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_version_current_type_idx" ON "policy_version" USING btree ("policy_type") WHERE "policy_version"."is_current";--> statement-breakpoint
CREATE INDEX "policy_version_current_idx" ON "policy_version" USING btree ("policy_type","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "user_policy_acceptance_user_policy_idx" ON "user_policy_acceptance" USING btree ("user_id","policy_version_id");--> statement-breakpoint
CREATE INDEX "user_policy_acceptance_user_idx" ON "user_policy_acceptance" USING btree ("user_id");