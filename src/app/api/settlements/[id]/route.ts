import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getSavedSettlement } from "@/lib/sheet";

export const dynamic = "force-dynamic";

// 저장된 정산 내역 단건 조회 (data 포함 — 상세/모달용)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const saved = await getSavedSettlement(Number(params.id));
    if (!saved) {
      return NextResponse.json({ error: "내역을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(saved);
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
