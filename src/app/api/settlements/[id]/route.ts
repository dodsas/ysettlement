import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import type { SettlementSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

// 저장된 정산 내역 단건 조회
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    const { rows } = await db.execute({
      sql: "SELECT id, title, created_at, data FROM settlements WHERE id = ?",
      args: [id],
    });
    if (rows.length === 0) {
      return NextResponse.json({ error: "내역을 찾을 수 없습니다." }, { status: 404 });
    }
    const r = rows[0];
    return NextResponse.json({
      id: Number(r.id),
      title: String(r.title),
      createdAt: String(r.created_at),
      data: JSON.parse(String(r.data)) as SettlementSnapshot,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 저장된 정산 내역 삭제
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    await db.execute({ sql: "DELETE FROM settlements WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
