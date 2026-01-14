ALTER TABLE "conversations" ALTER COLUMN "state" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "close_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "memory_items_unique_content_hash_idx" ON "memory_items" USING btree ("user_id","content_hash");