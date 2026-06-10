import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 이름 수정
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    const { name } = await req.json();
    const trimmed = String(name ?? "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
    }
    await db.execute({
      sql: "UPDATE people SET name = ? WHERE id = ?",
      args: [trimmed, id],
    });
    return NextResponse.json({ id, name: trimmed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 사람(열) 삭제
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    // cells 는 FK ON DELETE CASCADE 가 항상 보장되지 않으므로 명시적으로 정리
    await db.execute({ sql: "DELETE FROM cells WHERE person_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM people WHERE id = ?", args: [id] });
    // 정산기준이 이 사람이었으면 해제
    await db.execute({
      sql: "DELETE FROM settings WHERE key = 'basis_person_id' AND value = ?",
      args: [String(id)],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
