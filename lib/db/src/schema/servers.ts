import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serversTable = pgTable("servers", {
  id: serial("id").primaryKey(),
  slotNumber: integer("slot_number").notNull().unique(),
  label: text("label").notNull(),
  status: text("status").notNull().default("available"), // available | occupied | maintenance
  region: text("region").notNull().default("us-east"),
  currentDeploymentId: integer("current_deployment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServerSchema = createInsertSchema(serversTable).omit({ id: true, createdAt: true });
export type InsertServer = z.infer<typeof insertServerSchema>;
export type Server = typeof serversTable.$inferSelect;
