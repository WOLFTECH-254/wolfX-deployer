import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const deploymentLogsTable = pgTable(
  "deployment_logs",
  {
    id: serial("id").primaryKey(),
    deploymentId: integer("deployment_id").notNull(),
    level: text("level").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byDeployment: index("deployment_logs_dep_idx").on(t.deploymentId, t.createdAt),
  }),
);

export type DeploymentLog = typeof deploymentLogsTable.$inferSelect;
