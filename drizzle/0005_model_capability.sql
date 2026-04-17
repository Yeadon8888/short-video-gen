CREATE TYPE "public"."model_capability" AS ENUM('video_generation', 'image_edit');
--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "capability" "model_capability" DEFAULT 'video_generation' NOT NULL;
