CREATE TYPE "public"."asset_transform_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "asset_transform_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"target_asset_id" uuid,
	"model_id" uuid,
	"status" "asset_transform_status" DEFAULT 'pending' NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "asset_transform_jobs" ADD CONSTRAINT "asset_transform_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transform_jobs" ADD CONSTRAINT "asset_transform_jobs_source_asset_id_user_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."user_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transform_jobs" ADD CONSTRAINT "asset_transform_jobs_target_asset_id_user_assets_id_fk" FOREIGN KEY ("target_asset_id") REFERENCES "public"."user_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transform_jobs" ADD CONSTRAINT "asset_transform_jobs_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;
