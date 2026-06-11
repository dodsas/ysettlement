import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedSettlement } from "@/lib/sheet";
import { formatWon, formatDate } from "@/lib/format";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const snap = await getSharedSettlement(params.token);
  return {
    title: snap ? `${snap.title} · 정산 내역` : "정산 내역",
    description: "공유된 정산 내역입니다.",
  };
}

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const saved = await getSharedSettlement(params.token);
  if (!saved) notFound();

  const { title, createdAt, data } = saved;
  const { people, items, cells, basisPersonId, basisName, settlement } = data;

  const cellMap = new Map<string, number>();
  for (const c of cells) cellMap.set(`${c.itemId}:${c.personId}`, c.amount);

  return (
    <div className="page">
      <header className="page-header">
        <span className="share-badge">🔗 공유된 정산 내역</span>
        <h1>{title}</h1>
        <p>
          {formatDate(createdAt)} · 정산기준{" "}
          <strong className="share-basis">{basisName ?? "미지정"}</strong>
        </p>
      </header>

      {/* 정산 결과 */}
      <div className="card">
        <h2 className="card-title">📊 정산 결과</h2>
        {basisName ? (
          <p className="basis-line">
            각 인원이 <strong>{basisName}</strong>에게 입금/환급할 금액
          </p>
        ) : (
          <p className="basis-line">정산기준이 지정되지 않은 내역입니다.</p>
        )}
        <div className="result-grid">
          {settlement.map((r) => {
            const isBasis = r.personId === basisPersonId;
            if (isBasis) {
              return (
                <div key={r.personId} className="result-item is-basis">
                  <div className="result-name">
                    <span>{r.name}</span>
                    <span className="basis-tag">기준</span>
                  </div>
                  <div className="result-amount settled">정산 받는 사람</div>
                  <div className="result-sub">
                    낸 돈 {formatWon(r.paid)} · 부담액 {formatWon(r.owed)}
                  </div>
                </div>
              );
            }
            const pay = r.payToBasis;
            const cls = pay > 0 ? "pay" : pay < 0 ? "refund" : "settled";
            const label =
              pay > 0
                ? `${formatWon(pay)} 입금`
                : pay < 0
                ? `${formatWon(-pay)} 환급`
                : "정산 완료";
            return (
              <div key={r.personId} className="result-item">
                <div className="result-name">
                  <span>{r.name}</span>
                </div>
                <div className={`result-amount ${cls}`}>{label}</div>
                <div className="result-sub">
                  {pay > 0
                    ? `${basisName ?? "기준"}에게 보낼 금액`
                    : pay < 0
                    ? `${basisName ?? "기준"}에게 받을 금액`
                    : "주고받을 금액 없음"}
                  <br />낸 돈 {formatWon(r.paid)} · 부담액 {formatWon(r.owed)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 입력 내역(읽기 전용) */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <h2 className="card-title" style={{ padding: "20px 20px 0" }}>
          🧾 입력 내역
        </h2>
        <div
          className="sheet-scroll"
          style={{ border: "none", boxShadow: "none", marginTop: 12 }}
        >
          <table className="sheet readonly">
            <thead>
              <tr>
                <th className="corner">
                  <div className="corner-inner">항목</div>
                </th>
                {people.map((p) => (
                  <th
                    key={p.id}
                    className={`col-head${p.id === basisPersonId ? " basis" : ""}`}
                  >
                    <div className="ro-head">{p.name}</div>
                    {p.id === basisPersonId && (
                      <div className="basis-tag">정산기준</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th className="row-head">
                    <div className="ro-rowhead">{item.name}</div>
                  </th>
                  {people.map((p) => {
                    const v = cellMap.get(`${item.id}:${p.id}`);
                    return (
                      <td
                        key={p.id}
                        className={`cell ro-cell${
                          p.id === basisPersonId ? " basis-col" : ""
                        }`}
                      >
                        {v === undefined ? "" : v.toLocaleString("ko-KR")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 레이아웃 (읽기 전용) */}
        <div className="sheet-mobile" style={{ padding: "0 16px 16px" }}>
          {items.map((item) => (
            <div key={item.id} className="m-item">
              <div className="m-item-head">
                <span className="m-item-ro-name">{item.name}</span>
              </div>
              <div className="m-rows">
                {people.map((p) => {
                  const v = cellMap.get(`${item.id}:${p.id}`);
                  const isBasis = p.id === basisPersonId;
                  return (
                    <div key={p.id} className="m-row">
                      <span className="m-row-name">
                        {p.name}
                        {isBasis && <span className="m-basis-dot">기준</span>}
                      </span>
                      <span className={`m-row-val${v === undefined ? " empty" : ""}`}>
                        {v === undefined ? "-" : `${v.toLocaleString("ko-KR")}원`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="share-foot">
        <Link href="/" className="share-home">
          ← 정산 시트로 이동
        </Link>
      </p>
    </div>
  );
}
