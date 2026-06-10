import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db, ensureSchema } from "@/lib/db";
import { loadSheet } from "@/lib/sheet";
import { calculateSettlement } from "@/lib/settlement";
import type { SettlementSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

// 저장된 정산 내역 목록 (최신순)
export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await db.execute(
      "SELECT id, title, created_at, data, share_token FROM settlements ORDER BY id DESC"
    );
    const list = rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      createdAt: String(r.created_at),
      shareToken: r.share_token == null ? "" : String(r.share_token),
      data: JSON.parse(String(r.data)) as SettlementSnapshot,
    }));
    return NextResponse.json(list);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 현재 시트를 정산 내역으로 저장(스냅샷)
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json().catch(() => ({}));

    const sheet = await loadSheet();
    const settlement = calculateSettlement(sheet);
    const basisName =
      sheet.basisPersonId == null
        ? null
        : sheet.people.find((p) => p.id === sheet.basisPersonId)?.name ?? null;

    const snapshot: SettlementSnapshot = { ...sheet, basisName, settlement };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const title = String(body?.title ?? "").trim() || `정산 ${stamp}`;
    const createdAt = now.toISOString();
    // 추측 불가능한 공유 토큰 (48 hex chars)
    const shareToken = randomBytes(24).toString("hex");

    const res = await db.execute({
      sql: "INSERT INTO settlements (title, created_at, data, share_token) VALUES (?, ?, ?, ?)",
      args: [title, createdAt, JSON.stringify(snapshot), shareToken],
    });

    return NextResponse.json({
      id: Number(res.lastInsertRowid),
      title,
      createdAt,
      shareToken,
      data: snapshot,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
