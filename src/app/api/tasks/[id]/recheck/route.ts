import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recheckSingleControl } from "@/lib/assessmentEngine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const userId = parseInt(session.sub, 10) || undefined;
    const res = await recheckSingleControl(id, userId);
    if (!res.ok) {
      return NextResponse.json({ error: res.error || "Re-check failed" }, { status: 400 });
    }

    return NextResponse.json(res);
  } catch (err: any) {
    console.error("[api/tasks/recheck] error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute re-check" }, { status: 500 });
  }
}
