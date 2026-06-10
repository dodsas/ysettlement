import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 셀 값 저장/삭제.
 * body: { itemId, personId, amount }
 *  - amount 가 null/""/undefined 이면 셀을 비운다(행 삭제).
 *  - 그 외에는 upsert.
 */
export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const { itemId, personId, amount } = await req.json();
    const iId = Number(itemId);
    const pId = Number(personId);
    if (!Number.isFinite(iId) || !Number.isFinite(pId)) {
      return NextResponse.json({ error: "잘못된 셀 좌표입니다." }, { status: 400 });
    }

    const isEmpty =
      amount === null ||
      amount === undefined ||
      (typeof amount === "string" && amount.trim() === "");

    if (isEmpty) {
      await db.execute({
        sql: "DELETE FROM cells WHERE item_id = ? AND person_id = ?",
        args: [iId, pId],
      });
      return NextResponse.json({ itemId: iId, personId: pId, amount: null });
    }

    const num = Number(amount);
    if (!Number.isFinite(num)) {
      return NextResponse.json({ error: "숫자만 입력할 수 있습니다." }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO cells (item_id, person_id, amount) VALUES (?, ?, ?)
            ON CONFLICT(item_id, person_id) DO UPDATE SET amount = excluded.amount`,
      args: [iId, pId, num],
    });
    return NextResponse.json({ itemId: iId, personId: pId, amount: num });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
