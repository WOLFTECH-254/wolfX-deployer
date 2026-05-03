import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deploymentsTable = pgTable("deployments", {
  id: serial("id").primaryKey(),
  appId: integer("app_id").notNull(),
  serverId: integer("server_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | stopped | failed | restarting
  envConfig: jsonb("env_config").notNull().$type<Record<string, string>>(),
  deployedBy: text("deployed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeploymentSchema = createInsertSchema(deploymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deploymentsTable.$inferSelect;
