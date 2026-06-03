import type { Request, Response, NextFunction } from "express";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function getUserId(req: Request): number {
  const id = req.session?.userId;
  if (!id) {
    throw new Error("Missing authenticated user on request");
  }
  return id;
}
