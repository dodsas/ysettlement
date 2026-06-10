import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 새 항목(행) 추가
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { name } = await req.json();
    const trimmed = String(name ?? "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "항목명을 입력하세요." }, { status: 400 });
    }
    const sortRes = await db.execute(
      "SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM items"
    );
    const sort = Number(sortRes.rows[0]?.next ?? 0);
    const res = await db.execute({
      sql: "INSERT INTO items (name, sort) VALUES (?, ?)",
      args: [trimmed, sort],
    });
    return NextResponse.json({ id: Number(res.lastInsertRowid), name: trimmed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
