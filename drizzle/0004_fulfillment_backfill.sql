-- ─── Enums ───
CREATE TYPE "public"."fulfillment_mode" AS ENUM('standard', 'backfill_until_target');
--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('pending', 'submitted', 'success', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."terminal_class" AS ENUM('content_policy', 'quota_exceeded', 'provider_error', 'timeout', 'unknown');

-- ─── tasks: new fulfillment columns ───
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "fulfillment_mode" "fulfillment_mode" DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "requested_count" integer;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "successful_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "delivery_deadline_at" timestamp with time zone;

-- ─── task_slots ───
--> statement-breakpoint
CREATE TABLE "task_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"slot_index" integer NOT NULL,
	"status" "slot_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"winner_item_id" uuid,
	"result_url" text,
	"last_fail_reason" text,
	"last_terminal_class" "terminal_class",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "task_slots" ADD CONSTRAINT "task_slots_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;

-- ─── task_items: new slot/attempt/retry columns ───
--> statement-breakpoint
ALTER TABLE "task_items" ADD COLUMN "slot_id" uuid;
--> statement-breakpoint
ALTER TABLE "task_items" ADD COLUMN "attempt_no" integer;
--> statement-breakpoint
ALTER TABLE "task_items" ADD COLUMN "retryable" boolean;
--> statement-breakpoint
ALTER TABLE "task_items" ADD COLUMN "terminal_class" "terminal_class";
--> statement-breakpoint
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_slot_id_task_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."task_slots"("id") ON DELETE cascade ON UPDATE no action;
