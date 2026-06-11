import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 즐겨찾기 + 최근 위치(최신 3개) 조회
export async function GET() {
  try {
    await ensureSchema();
    const [favRes, recentRes] = await Promise.all([
      db.execute(
        "SELECT id, alias, label, x, y FROM favorite_locations ORDER BY id DESC"
      ),
      db.execute(
        "SELECT label, x, y FROM recent_locations ORDER BY id DESC LIMIT 3"
      ),
    ]);
    return NextResponse.json({
      favorites: favRes.rows.map((r) => ({
        id: Number(r.id),
        alias: String(r.alias),
        label: String(r.label),
        x: r.x == null ? "" : String(r.x),
        y: r.y == null ? "" : String(r.y),
      })),
      recents: recentRes.rows.map((r) => ({
        label: String(r.label),
        x: r.x == null ? "" : String(r.x),
        y: r.y == null ? "" : String(r.y),
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 즐겨찾기 추가 (별칭 지정)
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { alias, label, x, y } = await req.json();
    const a = String(alias ?? "").trim();
    const l = String(label ?? "").trim();
    if (!a) {
      return NextResponse.json({ error: "별칭을 입력하세요." }, { status: 400 });
    }
    if (!l) {
      return NextResponse.json({ error: "저장할 위치가 없습니다." }, { status: 400 });
    }
    const res = await db.execute({
      sql: "INSERT INTO favorite_locations (alias, label, x, y, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [a, l, x ? String(x) : null, y ? String(y) : null, new Date().toISOString()],
    });
    return NextResponse.json({ id: Number(res.lastInsertRowid), alias: a, label: l });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
