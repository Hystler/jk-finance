import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

type HealthResponse = {
  status: "ok" | "error";
  db: "connected" | "disconnected";
  timestamp: string;
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString()
    });
  } catch {
    return res.status(503).json({
      status: "error",
      db: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
}
