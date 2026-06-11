import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db, ensureSchema } from "@/lib/db";
import { loadSheet, listSavedSettlements } from "@/lib/sheet";
import { calculateSettlement } from "@/lib/settlement";
import type { SettlementSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

// 저장된 정산 내역 목록 (최신순, 요약 — 큰 data 블롭 미포함)
export async function GET() {
  try {
    const list = await listSavedSettlements();
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
      sql: "INSERT INTO settlements (title, created_at, data, share_token, basis_name, people_count) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        title,
        createdAt,
        JSON.stringify(snapshot),
        shareToken,
        basisName,
        sheet.people.length,
      ],
    });

    return NextResponse.json({
      id: Number(res.lastInsertRowid),
      title,
      createdAt,
      shareToken,
      basisName,
      peopleCount: sheet.people.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
