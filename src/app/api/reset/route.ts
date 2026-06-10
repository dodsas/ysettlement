import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 현재 시트 초기화. 인원/항목/셀/정산기준을 모두 비운다.
 * 저장된 정산 내역(settlements)은 건드리지 않는다.
 */
export async function POST() {
  try {
    await ensureSchema();
    await db.batch(
      [
        "DELETE FROM cells",
        "DELETE FROM items",
        "DELETE FROM people",
        "DELETE FROM settings WHERE key = 'basis_person_id'",
      ],
      "write"
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
