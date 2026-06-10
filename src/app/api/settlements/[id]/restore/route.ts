import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import type { SettlementSnapshot } from "@/lib/types";
import type { InStatement } from "@libsql/client";

export const dynamic = "force-dynamic";

/**
 * 저장된 정산 내역을 현재 시트로 복원(재정산).
 * 기존 people / items / cells / 정산기준 을 모두 비우고
 * 스냅샷에 저장된 값(원래 id 그대로)으로 다시 채운다.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);

    const { rows } = await db.execute({
      sql: "SELECT data FROM settlements WHERE id = ?",
      args: [id],
    });
    if (rows.length === 0) {
      return NextResponse.json({ error: "내역을 찾을 수 없습니다." }, { status: 404 });
    }

    const snap = JSON.parse(String(rows[0].data)) as SettlementSnapshot;

    const stmts: InStatement[] = [
      // 기존 데이터 초기화
      "DELETE FROM cells",
      "DELETE FROM items",
      "DELETE FROM people",
      "DELETE FROM settings WHERE key = 'basis_person_id'",
    ];

    // 사람 복원 (원래 id 유지, 배열 순서를 sort 로)
    snap.people.forEach((p, i) => {
      stmts.push({
        sql: "INSERT INTO people (id, name, sort) VALUES (?, ?, ?)",
        args: [p.id, p.name, i],
      });
    });

    // 항목 복원
    snap.items.forEach((it, i) => {
      stmts.push({
        sql: "INSERT INTO items (id, name, sort) VALUES (?, ?, ?)",
        args: [it.id, it.name, i],
      });
    });

    // 셀 복원
    for (const c of snap.cells) {
      stmts.push({
        sql: "INSERT INTO cells (item_id, person_id, amount) VALUES (?, ?, ?)",
        args: [c.itemId, c.personId, c.amount],
      });
    }

    // 정산기준 복원
    if (snap.basisPersonId != null) {
      stmts.push({
        sql: "INSERT INTO settings (key, value) VALUES ('basis_person_id', ?)",
        args: [String(snap.basisPersonId)],
      });
    }

    await db.batch(stmts, "write");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
