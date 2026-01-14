-- Migration: Rename items to memory_items + add external_id
-- Supports deduplication of user memories

-- 1. Rename table
ALTER TABLE "items" RENAME TO "memory_items";

-- 2. Add external_id column for deduplication
ALTER TABLE "memory_items" ADD COLUMN "external_id" text;

-- 3. Rename existing indexes
ALTER INDEX "items_user_id_idx" RENAME TO "memory_items_user_id_idx";
ALTER INDEX "items_type_idx" RENAME TO "memory_items_type_idx";
ALTER INDEX "items_metadata_idx" RENAME TO "memory_items_metadata_idx";

-- 4. Create unique index for deduplication (partial index: only when external_id is not null)
CREATE UNIQUE INDEX "memory_items_unique_external_idx" ON "memory_items" ("user_id", "type", "external_id")
WHERE "external_id" IS NOT NULL;

-- 5. Backfill external_id from metadata for existing records
UPDATE "memory_items" 
SET "external_id" = (metadata->>'tmdb_id')::text 
WHERE type IN ('movie', 'tv_show') AND metadata->>'tmdb_id' IS NOT NULL;

UPDATE "memory_items" 
SET "external_id" = (metadata->>'video_id')::text 
WHERE type = 'video' AND metadata->>'video_id' IS NOT NULL;

UPDATE "memory_items" 
SET "external_id" = LOWER(REGEXP_REPLACE(metadata->>'url', '^https?://(www\.)?', ''))
WHERE type = 'link' AND metadata->>'url' IS NOT NULL;
