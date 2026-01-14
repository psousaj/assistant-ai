ALTER TABLE "items" RENAME TO "memory_items";--> statement-breakpoint
ALTER TABLE "memory_items" DROP CONSTRAINT "items_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "items_user_id_idx";--> statement-breakpoint
DROP INDEX "items_type_idx";--> statement-breakpoint
DROP INDEX "items_metadata_idx";--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_items_user_id_idx" ON "memory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_items_type_idx" ON "memory_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "memory_items_metadata_idx" ON "memory_items" USING gin ("metadata");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_items_unique_external_idx" ON "memory_items" USING btree ("user_id","type","external_id");