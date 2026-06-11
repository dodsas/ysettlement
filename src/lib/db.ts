import { createClient, type Client } from "@libsql/client";
import { randomBytes } from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __dbReady: Promise<void> | undefined;
}

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요."
    );
  }
  return createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
}

// 개발 모드에서 hot-reload 시 커넥션이 중복 생성되지 않도록 전역 캐싱
export const db: Client = global.__dbClient ?? (global.__dbClient = createDbClient());

/**
 * 스키마 생성 + 최초 1회 예시 데이터 시딩.
 * 모든 API 라우트는 호출 전에 await ensureSchema() 를 거친다.
 */
export function ensureSchema(): Promise<void> {
  if (!global.__dbReady) {
    global.__dbReady = initSchema();
  }
  return global.__dbReady;
}

async function initSchema(): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS people (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS items (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS cells (
        item_id   INTEGER NOT NULL REFERENCES items(id)  ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        amount    REAL NOT NULL,
        PRIMARY KEY (item_id, person_id)
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      )`,
      // 저장된 정산 내역(스냅샷). data 에 저장 시점의 시트+정산결과 JSON 보관.
      // share_token: 공유 URL 용 추측 불가능한 랜덤 토큰.
      `CREATE TABLE IF NOT EXISTS settlements (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        data        TEXT NOT NULL,
        share_token TEXT
      )`,
      // 경로 계산에 사용된 최근 위치 (라벨 기준 dedupe, 최신순)
      `CREATE TABLE IF NOT EXISTS recent_locations (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        label   TEXT NOT NULL,
        x       TEXT,
        y       TEXT,
        used_at TEXT NOT NULL
      )`,
      // 즐겨찾기 위치 (별칭 alias 지정)
      `CREATE TABLE IF NOT EXISTS favorite_locations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        alias      TEXT NOT NULL,
        label      TEXT NOT NULL,
        x          TEXT,
        y          TEXT,
        created_at TEXT NOT NULL
      )`,
    ],
    "write"
  );

  // 기존 DB 마이그레이션: share_token 컬럼이 없으면 추가 (이미 있으면 에러 무시)
  try {
    await db.execute("ALTER TABLE settlements ADD COLUMN share_token TEXT");
  } catch {
    /* 이미 존재 */
  }
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_token ON settlements(share_token)"
  );

  // 토큰이 없는 기존 내역에 공유 토큰 백필
  const missing = await db.execute(
    "SELECT id FROM settlements WHERE share_token IS NULL OR share_token = ''"
  );
  for (const row of missing.rows) {
    await db.execute({
      sql: "UPDATE settlements SET share_token = ? WHERE id = ?",
      args: [randomBytes(24).toString("hex"), Number(row.id)],
    });
  }

  // 비어있을 때만 예시 데이터 시딩
  const { rows } = await db.execute("SELECT COUNT(*) AS c FROM people");
  const count = Number(rows[0]?.c ?? 0);
  if (count === 0) {
    await seedExampleData();
  }
}

async function seedExampleData(): Promise<void> {
  // 사람: 영희, 유선, 영준
  const people = ["영희", "유선", "영준"];
  const personIds: Record<string, number> = {};
  for (let i = 0; i < people.length; i++) {
    const res = await db.execute({
      sql: "INSERT INTO people (name, sort) VALUES (?, ?)",
      args: [people[i], i],
    });
    personIds[people[i]] = Number(res.lastInsertRowid);
  }

  // 항목: 유류비, 팝콘
  const items = ["유류비", "팝콘"];
  const itemIds: Record<string, number> = {};
  for (let i = 0; i < items.length; i++) {
    const res = await db.execute({
      sql: "INSERT INTO items (name, sort) VALUES (?, ?)",
      args: [items[i], i],
    });
    itemIds[items[i]] = Number(res.lastInsertRowid);
  }

  // 셀 값 (빈 칸은 행을 만들지 않음)
  // 유류비 | 영희(빈칸) | 유선 50000 | 영준 0
  // 팝콘   | 영희 300   | 유선 0     | 영준(빈칸)
  const cells: Array<[string, string, number]> = [
    ["유류비", "유선", 50000],
    ["유류비", "영준", 0],
    ["팝콘", "영희", 300],
    ["팝콘", "유선", 0],
  ];
  for (const [item, person, amount] of cells) {
    await db.execute({
      sql: "INSERT INTO cells (item_id, person_id, amount) VALUES (?, ?, ?)",
      args: [itemIds[item], personIds[person], amount],
    });
  }

  // 정산기준: 유선
  await db.execute({
    sql: "INSERT INTO settings (key, value) VALUES ('basis_person_id', ?)",
    args: [String(personIds["유선"])],
  });
}
