CREATE TABLE IF NOT EXISTS "gallery_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "video_url" text NOT NULL,
  "thumbnail_url" text,
  "prompt" text,
  "script_json" jsonb,
  "model_slug" varchar(50),
  "tags" jsonb DEFAULT '[]'::jsonb,
  "view_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "is_approved" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gallery_items_approved_created_idx" ON "gallery_items" ("is_approved", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "gallery_items_user_id_idx" ON "gallery_items" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "gallery_items_task_id_unique" ON "gallery_items" ("task_id");
