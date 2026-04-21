-- Stripe integration schema changes.
-- Snapshot contains the full target DB state; this file intentionally
-- only emits the INCREMENTAL changes on top of 0011, because migrations
-- 0003–0011 are already applied on every environment and drizzle's meta
-- snapshots for those idx were lost.

-- 1. Extend payment_provider enum with 'stripe'
ALTER TYPE "public"."payment_provider" ADD VALUE IF NOT EXISTS 'stripe';--> statement-breakpoint

-- 2. users: add stripe_customer_id (nullable, unique)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint

-- 3. payment_orders: new provider default + stripe id columns
ALTER TABLE "payment_orders" ALTER COLUMN "provider" SET DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "stripe_session_id" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" varchar(128);--> statement-breakpoint

-- 4. stripe_events: idempotency log for webhooks
CREATE TABLE IF NOT EXISTS "stripe_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"payload" jsonb
);
