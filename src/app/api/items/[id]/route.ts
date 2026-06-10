import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 항목명 수정
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
      return NextResponse.json({ error: "항목명을 입력하세요." }, { status: 400 });
    }
    await db.execute({
      sql: "UPDATE items SET name = ? WHERE id = ?",
      args: [trimmed, id],
    });
    return NextResponse.json({ id, name: trimmed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 항목(행) 삭제
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSchema();
    const id = Number(params.id);
    await db.execute({ sql: "DELETE FROM cells WHERE item_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM items WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
