ALTER TABLE "tasks"
ADD COLUMN "result_asset_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;
