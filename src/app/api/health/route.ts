import { NextResponse } from "next/server";
import { isSetupComplete, getDbDialect } from "@/lib/setup";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const complete = isSetupComplete();
  const dialect = getDbDialect();

  if (!complete) {
    return NextResponse.json({
      status: "ok",
      setupComplete: false,
      message: "PixxelAI is running and ready for initial setup.",
      dialect,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Probe database liveness
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({
      status: "ok",
      setupComplete: true,
      dialect,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database probe failed.";
    return NextResponse.json(
      {
        status: "error",
        setupComplete: true,
        dialect,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
