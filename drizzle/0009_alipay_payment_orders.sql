ALTER TYPE "public"."credit_txn_type" ADD VALUE 'payment';--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('pending', 'paid', 'failed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('alipay');--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "payment_provider" DEFAULT 'alipay' NOT NULL,
	"status" "payment_order_status" DEFAULT 'pending' NOT NULL,
	"out_trade_no" varchar(64) NOT NULL,
	"provider_trade_no" varchar(64),
	"subject" varchar(256) NOT NULL,
	"package_id" varchar(64),
	"amount_fen" integer NOT NULL,
	"credits" integer NOT NULL,
	"payment_url" text,
	"raw_notify" jsonb,
	"paid_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_out_trade_no_unique" UNIQUE("out_trade_no")
);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
