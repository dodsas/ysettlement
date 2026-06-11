import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getRoundTripCost } from "@/lib/naverMaps";
import type { InStatement } from "@libsql/client";

export const dynamic = "force-dynamic";

/**
 * 네이버 지도 경로로 유류비/통행료를 계산해 시트에 채운다.
 * body: { start, goal, payerId, addFuel?, addToll? }
 *  - 결제자(payerId) 칸엔 전액, 나머지 인원 칸엔 0 을 넣어 모두가 균등 분담하도록 한다.
 * 반환: 계산된 RouteCost
 */
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json().catch(() => ({}));
    const start = String(body?.start ?? "").trim();
    const goal = String(body?.goal ?? "").trim();
    // 자동완성에서 선택 시 좌표가 함께 옴 (재지오코딩 생략 + 정확도 ↑)
    const startCoord =
      body?.startX && body?.startY
        ? { x: String(body.startX), y: String(body.startY) }
        : null;
    const goalCoord =
      body?.goalX && body?.goalY
        ? { x: String(body.goalX), y: String(body.goalY) }
        : null;
    const payerId = Number(body?.payerId);
    const addFuel = body?.addFuel !== false; // 기본 추가
    const addToll = body?.addToll !== false;

    if (!start || !goal) {
      return NextResponse.json(
        { error: "출발지와 도착지를 모두 입력하세요." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(payerId)) {
      return NextResponse.json(
        { error: "결제자를 선택하세요." },
        { status: 400 }
      );
    }

    // 결제자 + 분담 대상 인원 확인
    const peopleRes = await db.execute("SELECT id FROM people ORDER BY sort, id");
    const peopleIds = peopleRes.rows.map((r) => Number(r.id));
    if (!peopleIds.includes(payerId)) {
      return NextResponse.json(
        { error: "결제자가 시트에 존재하지 않습니다." },
        { status: 400 }
      );
    }

    // 네이버 지도 왕복 경로 비용 계산 (좌표가 있으면 그대로, 없으면 주소 지오코딩)
    const cost = await getRoundTripCost(
      { address: start, x: startCoord?.x, y: startCoord?.y },
      { address: goal, x: goalCoord?.x, y: goalCoord?.y }
    );

    // 항목별로 find-or-create 후, 결제자=전액 / 나머지=0 으로 셀 채우기
    const stmts: InStatement[] = [];
    const targets: Array<{ name: string; amount: number }> = [];
    if (addFuel) targets.push({ name: "유류비", amount: cost.fuelPrice });
    if (addToll) targets.push({ name: "통행료", amount: cost.tollFare });

    for (const t of targets) {
      // 같은 이름 항목이 있으면 재사용, 없으면 생성
      const existing = await db.execute({
        sql: "SELECT id FROM items WHERE name = ? ORDER BY id LIMIT 1",
        args: [t.name],
      });
      let itemId: number;
      if (existing.rows.length > 0) {
        itemId = Number(existing.rows[0].id);
      } else {
        const sortRes = await db.execute(
          "SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM items"
        );
        const ins = await db.execute({
          sql: "INSERT INTO items (name, sort) VALUES (?, ?)",
          args: [t.name, Number(sortRes.rows[0]?.next ?? 0)],
        });
        itemId = Number(ins.lastInsertRowid);
      }

      for (const pid of peopleIds) {
        stmts.push({
          sql: `INSERT INTO cells (item_id, person_id, amount) VALUES (?, ?, ?)
                ON CONFLICT(item_id, person_id) DO UPDATE SET amount = excluded.amount`,
          args: [itemId, pid, pid === payerId ? t.amount : 0],
        });
      }
    }

    if (stmts.length > 0) await db.batch(stmts, "write");

    // 최근 위치 기록 (라벨 기준 dedupe → 재삽입으로 최신화). 오래된 항목은 정리.
    const now = new Date().toISOString();
    for (const loc of [
      { label: start, x: startCoord?.x, y: startCoord?.y },
      { label: goal, x: goalCoord?.x, y: goalCoord?.y },
    ]) {
      if (!loc.label) continue;
      await db.execute({
        sql: "DELETE FROM recent_locations WHERE label = ?",
        args: [loc.label],
      });
      await db.execute({
        sql: "INSERT INTO recent_locations (label, x, y, used_at) VALUES (?, ?, ?, ?)",
        args: [loc.label, loc.x ?? null, loc.y ?? null, now],
      });
    }
    // 최근 20개만 유지
    await db.execute(
      "DELETE FROM recent_locations WHERE id NOT IN (SELECT id FROM recent_locations ORDER BY id DESC LIMIT 20)"
    );

    return NextResponse.json(cost);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
