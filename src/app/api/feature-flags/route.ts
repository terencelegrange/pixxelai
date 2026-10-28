import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  category: "system" | "standards";
}

export async function GET() {
  await initDb();
  const rows = await (prisma as any).featureFlag.findMany({
    orderBy: [
      { category: "desc" },
      { key: "asc" },
    ],
    select: {
      key: true,
      enabled: true,
      label: true,
      description: true,
      category: true,
    },
  });
  const flags: Record<string, FeatureFlag> = {};
  for (const r of rows) {
    const cat = r.category === "standards" || r.key.startsWith("standards_") ? "standards" : "system";
    flags[r.key] = {
      key: r.key,
      enabled: r.enabled === 1,
      label: r.label,
      description: r.description,
      category: cat,
    };
  }
  return NextResponse.json(flags);
}
