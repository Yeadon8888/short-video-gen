ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'partner';--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."partner_status" AS ENUM('active', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "display_name" varchar(100),
  "status" "partner_status" DEFAULT 'active' NOT NULL,
  "commission_rate_bps" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partner_profiles_user_id_unique" UNIQUE("user_id"),
  CONSTRAINT "partner_profiles_code_unique" UNIQUE("code")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_attributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "partner_id" uuid NOT NULL,
  "referral_code" varchar(64) NOT NULL,
  "first_touch_at" timestamp with time zone DEFAULT now() NOT NULL,
  "registered_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partner_attributions_user_id_unique" UNIQUE("user_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partner_credit_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "from_user_id" uuid NOT NULL,
  "to_user_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "partner_profiles" DROP CONSTRAINT IF EXISTS "partner_profiles_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" DROP CONSTRAINT IF EXISTS "partner_profiles_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_attributions" DROP CONSTRAINT IF EXISTS "partner_attributions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "partner_attributions" ADD CONSTRAINT "partner_attributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_attributions" DROP CONSTRAINT IF EXISTS "partner_attributions_partner_id_partner_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "partner_attributions" ADD CONSTRAINT "partner_attributions_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" DROP CONSTRAINT IF EXISTS "partner_credit_transfers_partner_id_partner_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" ADD CONSTRAINT "partner_credit_transfers_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" DROP CONSTRAINT IF EXISTS "partner_credit_transfers_from_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" ADD CONSTRAINT "partner_credit_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" DROP CONSTRAINT IF EXISTS "partner_credit_transfers_to_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "partner_credit_transfers" ADD CONSTRAINT "partner_credit_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "partner_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_partner_id_partner_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "partner_attributions_partner_id_idx" ON "partner_attributions" ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_credit_transfers_partner_id_idx" ON "partner_credit_transfers" ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_orders_partner_id_idx" ON "payment_orders" ("partner_id");
--> statement-breakpoint

ALTER TABLE "public"."partner_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."partner_attributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."partner_credit_transfers" ENABLE ROW LEVEL SECURITY;
