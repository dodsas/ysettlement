const { createClient } = require("@libsql/client");
const fs = require("fs");

// .env 로드
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

(async () => {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  const idx = await db.execute(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name"
  );
  console.log("=== 인덱스 목록 ===");
  for (const r of idx.rows) console.log(`  ${r.tbl_name}.${r.name}`);

  // EXPLAIN QUERY PLAN: 인원 삭제 시 cells 조회가 인덱스를 타는지
  console.log("=== EXPLAIN: DELETE FROM cells WHERE person_id=? ===");
  const plan = await db.execute(
    "EXPLAIN QUERY PLAN SELECT * FROM cells WHERE person_id = 1"
  );
  for (const r of plan.rows) console.log("  " + r.detail);

  console.log("=== EXPLAIN: settlements ORDER BY id DESC ===");
  const plan2 = await db.execute(
    "EXPLAIN QUERY PLAN SELECT id, title FROM settlements ORDER BY id DESC"
  );
  for (const r of plan2.rows) console.log("  " + r.detail);
})();
