import type { Request, Response, NextFunction } from "express";
import { getAdminPassword } from "../lib/platform-init";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided !== getAdminPassword()) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
