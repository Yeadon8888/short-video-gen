CREATE TABLE "task_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_mode" varchar(20) NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"title" text,
	"batch_theme" text,
	"selection_mode" varchar(20),
	"params_json" jsonb,
	"requested_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_group_id" uuid;
--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_group_id_task_groups_id_fk" FOREIGN KEY ("task_group_id") REFERENCES "public"."task_groups"("id") ON DELETE set null ON UPDATE no action;
