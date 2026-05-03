import { pgTable, integer, text, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const platformConfigTable = pgTable(
  "platform_config",
  {
    id: integer("id").primaryKey().default(1),
    botRepoUrl: text("bot_repo_url").notNull(),
    botRepoOwner: text("bot_repo_owner").notNull(),
    botRepoName: text("bot_repo_name").notNull(),
    botName: text("bot_name").notNull(),
    botDescription: text("bot_description"),
    botLogo: text("bot_logo"),
    botAppJson: jsonb("bot_app_json").notNull().$type<Record<string, unknown>>(),
    slotCount: integer("slot_count").notNull().default(30),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [check("platform_config_singleton", sql`${t.id} = 1`)],
);

export type PlatformConfig = typeof platformConfigTable.$inferSelect;

export const updatePlatformConfigSchema = z.object({
  botRepoUrl: z.string().url().optional(),
  slotCount: z.number().int().min(1).max(500).optional(),
});
export type UpdatePlatformConfig = z.infer<typeof updatePlatformConfigSchema>;
