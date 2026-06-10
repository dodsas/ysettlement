import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 정산기준 인원 설정.
 * body: { basisPersonId: number | null }
 */
export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const { basisPersonId } = await req.json();
    const value =
      basisPersonId === null || basisPersonId === undefined
        ? null
        : String(Number(basisPersonId));

    if (value === null) {
      await db.execute(
        "DELETE FROM settings WHERE key = 'basis_person_id'"
      );
    } else {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES ('basis_person_id', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [value],
      });
    }
    return NextResponse.json({ basisPersonId: value === null ? null : Number(value) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
