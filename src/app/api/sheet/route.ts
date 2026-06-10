import { NextResponse } from "next/server";
import { loadSheet } from "@/lib/sheet";
import { calculateSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sheet = await loadSheet();
    const settlement = calculateSettlement(sheet);
    return NextResponse.json({ ...sheet, settlement });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
