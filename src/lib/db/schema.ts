import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ───

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const taskTypeEnum = pgEnum("task_type", ["theme", "remix", "url", "scene_gen", "analyze"]);
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "analyzing",
  "generating",
  "polling",
  "done",
  "failed",
  "scheduled",
]);
export const creditTxnTypeEnum = pgEnum("credit_txn_type", [
  "grant",    // admin 充值
  "consume",  // 生成消费
  "refund",   // 退款
  "adjust",   // 管理员手动调整
  "payment",  // 支付充值
]);
export const paymentOrderStatusEnum = pgEnum("payment_order_status", [
  "pending",
  "paid",
  "failed",
  "closed",
]);
export const paymentProviderEnum = pgEnum("payment_provider", ["alipay", "stripe"]);
export const assetTypeEnum = pgEnum("asset_type", ["image", "video"]);
export const fulfillmentModeEnum = pgEnum("fulfillment_mode", [
  "standard",
  "backfill_until_target",
]);
export const slotStatusEnum = pgEnum("slot_status", [
  "pending",    // 等待首次提交
  "submitted",  // 已提交给 provider，等待结果
  "success",    // 已成功产出视频
  "failed",     // 已耗尽重试，彻底失败
]);
export const terminalClassEnum = pgEnum("terminal_class", [
  "content_policy",  // 内容审核，不可重试
  "quota_exceeded",  // 配额耗尽，不可重试
  "provider_error",  // provider 内部错误，可重试
  "timeout",         // 超时，可重试
  "unknown",         // 未知，保守重试
]);
export const modelCapabilityEnum = pgEnum("model_capability", [
  "video_generation",
  "image_edit",
  "script_generation",
]);
export const assetTransformStatusEnum = pgEnum("asset_transform_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);

// ─── Users ───

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Supabase Auth user ID — links to auth.users */
  authId: uuid("auth_id").unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 100 }),
  role: userRoleEnum("role").default("user").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  credits: integer("credits").default(0).notNull(),
  /** Stripe Customer ID (cus_...), set lazily on first checkout */
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Models (可用视频模型配置) ───

export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).unique().notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // "plato" | "veo" etc.
  capability: modelCapabilityEnum("capability").default("video_generation").notNull(),
  creditsPerGen: integer("credits_per_gen").default(10).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  /** Per-model API key (overrides env `VIDEO_API_KEY` if set) */
  apiKey: text("api_key"),
  /** Per-model API base URL (overrides env `VIDEO_BASE_URL` if set) */
  baseUrl: text("base_url"),
  defaultParams: jsonb("default_params").$type<{
    orientation?: "portrait" | "landscape";
    duration?: number;
    count?: number;
    allowedDurations?: number[];
    [key: string]: unknown;
  }>().default({}),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Task Groups (批量任务组) ───

export const taskGroups = pgTable("task_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceMode: varchar("source_mode", { length: 20 }).notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  title: text("title"),
  batchTheme: text("batch_theme"),
  selectionMode: varchar("selection_mode", { length: 20 }),
  paramsJson: jsonb("params_json").$type<{
    orientation: "portrait" | "landscape";
    duration: 4 | 5 | 6 | 8 | 10 | 15;
    count: number;
    platform: "douyin" | "tiktok";
    outputLanguage?: string; // See src/lib/video/languages.ts — widened so new langs don't require a migration.
    model: string;
    batchUnitsPerProduct?: number;
    batchProductCount?: number;
    selectedImageIds?: string[];
    selectedAssets?: { id: string; url: string; filename?: string | null }[];
  }>(),
  requestedCount: integer("requested_count").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  creditsCost: integer("credits_cost").default(0).notNull(),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Tasks (视频生成任务) ───

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  taskGroupId: uuid("task_group_id").references(() => taskGroups.id, { onDelete: "set null" }),
  type: taskTypeEnum("type").notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  modelId: uuid("model_id").references(() => models.id),
  inputText: text("input_text"),
  videoSourceUrl: text("video_source_url"),
  soraPrompt: text("sora_prompt"),
  scriptJson: jsonb("script_json"),
  resultUrls: jsonb("result_urls").$type<string[]>().default([]),
  resultAssetKeys: jsonb("result_asset_keys").$type<string[]>().default([]),
  creditsCost: integer("credits_cost").default(0).notNull(),
  paramsJson: jsonb("params_json").$type<{
    orientation: "portrait" | "landscape";
    duration: 4 | 5 | 6 | 8 | 10 | 15;
    count: number;
    platform: "douyin" | "tiktok";
    outputLanguage?: string; // See src/lib/video/languages.ts — widened so new langs don't require a migration.
    model: string;
    imageUrls?: string[];
    sourceMode?: "theme" | "url" | "upload" | "batch";
    creativeBrief?: string;
    batchTheme?: string;
    batchUnitsPerProduct?: number;
    batchProductCount?: number;
    selectionMode?: "single" | "sequence";
    selectedImageIds?: string[];
    selectedAssets?: { id: string; url: string; filename?: string | null }[];
    assignedAssetId?: string;
    assignedAssetIndex?: number;
    batchRunId?: string;
    batchIndex?: number;
    batchTotal?: number;
  }>(),
  errorMessage: text("error_message"),
  /** When set, task is deferred to this time (定时托管) */
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // ─── Fulfillment fields ───
  /** "standard" = current behavior; "backfill_until_target" = auto-retry until requestedCount met */
  fulfillmentMode: fulfillmentModeEnum("fulfillment_mode").default("standard").notNull(),
  /** Target number of successful videos (only meaningful when fulfillmentMode = backfill_until_target) */
  requestedCount: integer("requested_count"),
  /** Number of slots that have reached success status */
  successfulCount: integer("successful_count").default(0).notNull(),
  /** When the first attempt was submitted to the provider */
  startedAt: timestamp("started_at", { withTimezone: true }),
  /** Deadline after which no more retries are triggered (3 hours after startedAt) */
  deliveryDeadlineAt: timestamp("delivery_deadline_at", { withTimezone: true }),
});

// ─── Task Slots (目标单元，一个 slot = 承诺交付一条视频) ───

export const taskSlots = pgTable("task_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  /** Slot index within the task (0-based) */
  slotIndex: integer("slot_index").notNull(),
  status: slotStatusEnum("status").default("pending").notNull(),
  /** Number of attempts made for this slot */
  attemptCount: integer("attempt_count").default(0).notNull(),
  /** The winning task_item id once this slot succeeds */
  winnerItemId: uuid("winner_item_id"),
  /** URL of the final delivered video */
  resultUrl: text("result_url"),
  /** Last failure reason for display */
  lastFailReason: text("last_fail_reason"),
  /** Last terminal class (drives retry decision) */
  lastTerminalClass: terminalClassEnum("last_terminal_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Task Items (单个视频生成子任务，一个 item = 一次 provider 尝试) ───

export const taskItems = pgTable("task_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  /** Which slot this attempt belongs to (null for standard mode tasks) */
  slotId: uuid("slot_id").references(() => taskSlots.id, { onDelete: "cascade" }),
  /** Attempt number within the slot (1-based). null for standard mode. */
  attemptNo: integer("attempt_no"),
  providerTaskId: varchar("provider_task_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  progress: varchar("progress", { length: 20 }).default("0%"),
  resultUrl: text("result_url"),
  failReason: text("fail_reason"),
  /** Whether this failure is retryable (set when status = FAILED) */
  retryable: boolean("retryable"),
  /** Classified failure category */
  terminalClass: terminalClassEnum("terminal_class"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Credit Transactions (积分流水) ───

export const creditTxns = pgTable("credit_txns", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: creditTxnTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // 正数=充值 负数=消费
  reason: text("reason"),
  modelId: uuid("model_id").references(() => models.id),
  taskId: uuid("task_id").references(() => tasks.id),
  adminId: uuid("admin_id").references(() => users.id),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Payment Orders (支付订单) ───

export const paymentOrders = pgTable("payment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: paymentProviderEnum("provider").default("stripe").notNull(),
  status: paymentOrderStatusEnum("status").default("pending").notNull(),
  outTradeNo: varchar("out_trade_no", { length: 64 }).unique().notNull(),
  providerTradeNo: varchar("provider_trade_no", { length: 64 }),
  subject: varchar("subject", { length: 256 }).notNull(),
  packageId: varchar("package_id", { length: 64 }),
  amountFen: integer("amount_fen").notNull(),
  credits: integer("credits").notNull(),
  paymentUrl: text("payment_url"),
  rawNotify: jsonb("raw_notify"),
  /** Stripe Checkout Session ID (cs_...) */
  stripeSessionId: varchar("stripe_session_id", { length: 128 }),
  /** Stripe PaymentIntent ID (pi_...), populated after payment */
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 128 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Idempotency log for Stripe webhooks. Each webhook event is recorded by
 * its Stripe event id; if we see the same id again (Stripe retries on
 * non-2xx), we short-circuit instead of re-granting credits.
 */
export const stripeEvents = pgTable("stripe_events", {
  /** Stripe event id, e.g. evt_1NxyZ... */
  id: varchar("id", { length: 64 }).primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  payload: jsonb("payload"),
});

// ─── User Assets (用户上传的参考图/视频) ───

export const userAssets = pgTable("user_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: assetTypeEnum("type").notNull(),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Asset Transform Jobs (产品图异步转图任务) ───

export const assetTransformJobs = pgTable("asset_transform_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceAssetId: uuid("source_asset_id")
    .references(() => userAssets.id, { onDelete: "cascade" })
    .notNull(),
  targetAssetId: uuid("target_asset_id").references(() => userAssets.id, {
    onDelete: "set null",
  }),
  modelId: uuid("model_id").references(() => models.id),
  status: assetTransformStatusEnum("status").default("pending").notNull(),
  creditsCost: integer("credits_cost").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Gallery Items (灵感广场) ───

export const galleryItems = pgTable("gallery_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt"),
  scriptJson: jsonb("script_json"),
  modelSlug: varchar("model_slug", { length: 50 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  viewCount: integer("view_count").default(0).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── System Config (键值对系统配置) ───

export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Announcements (公告) ───

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Type exports ───

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type TaskGroup = typeof taskGroups.$inferSelect;
export type NewTaskGroup = typeof taskGroups.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskSlot = typeof taskSlots.$inferSelect;
export type NewTaskSlot = typeof taskSlots.$inferInsert;
export type TaskItem = typeof taskItems.$inferSelect;
export type CreditTxn = typeof creditTxns.$inferSelect;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
export type UserAsset = typeof userAssets.$inferSelect;
export type AssetTransformJob = typeof assetTransformJobs.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
export type NewGalleryItem = typeof galleryItems.$inferInsert;
export type SystemConfigRow = typeof systemConfig.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
