import { db, ensureSchema } from "./db";
import type { SheetData, SavedSettlement, SettlementSnapshot } from "./types";

function mapSettlementRow(r: Record<string, unknown>): SavedSettlement {
  return {
    id: Number(r.id),
    title: String(r.title),
    createdAt: String(r.created_at),
    shareToken: r.share_token == null ? "" : String(r.share_token),
    data: JSON.parse(String(r.data)) as SettlementSnapshot,
  };
}

/** 저장된 정산 내역 단건 조회 by id (소유자용, 없으면 null) */
export async function getSavedSettlement(
  id: number
): Promise<SavedSettlement | null> {
  await ensureSchema();
  const { rows } = await db.execute({
    sql: "SELECT id, title, created_at, data, share_token FROM settlements WHERE id = ?",
    args: [id],
  });
  if (rows.length === 0) return null;
  return mapSettlementRow(rows[0] as Record<string, unknown>);
}

/** 저장된 정산 내역 목록 (최신순) */
export async function listSavedSettlements(): Promise<SavedSettlement[]> {
  await ensureSchema();
  const { rows } = await db.execute(
    "SELECT id, title, created_at, data, share_token FROM settlements ORDER BY id DESC"
  );
  return rows.map((r) => mapSettlementRow(r as Record<string, unknown>));
}

/** 공유 토큰으로 정산 내역 조회 (공유 페이지용, 없으면 null) */
export async function getSharedSettlement(
  token: string
): Promise<SavedSettlement | null> {
  await ensureSchema();
  if (!token) return null;
  const { rows } = await db.execute({
    sql: "SELECT id, title, created_at, data, share_token FROM settlements WHERE share_token = ?",
    args: [token],
  });
  if (rows.length === 0) return null;
  return mapSettlementRow(rows[0] as Record<string, unknown>);
}

/** DB에서 시트 전체 데이터를 읽어온다. */
export async function loadSheet(): Promise<SheetData> {
  await ensureSchema();

  const [peopleRes, itemsRes, cellsRes, basisRes] = await Promise.all([
    db.execute("SELECT id, name FROM people ORDER BY sort, id"),
    db.execute("SELECT id, name FROM items ORDER BY sort, id"),
    db.execute("SELECT item_id, person_id, amount FROM cells"),
    db.execute("SELECT value FROM settings WHERE key = 'basis_person_id'"),
  ]);

  const basisRaw = basisRes.rows[0]?.value;
  const basisPersonId =
    basisRaw === null || basisRaw === undefined || basisRaw === ""
      ? null
      : Number(basisRaw);

  return {
    people: peopleRes.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
    })),
    items: itemsRes.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
    })),
    cells: cellsRes.rows.map((r) => ({
      itemId: Number(r.item_id),
      personId: Number(r.person_id),
      amount: Number(r.amount),
    })),
    basisPersonId,
  };
}
