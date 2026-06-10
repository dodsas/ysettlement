"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Person,
  Item,
  Cell,
  SettlementResult,
  SavedSettlement,
} from "@/lib/types";
import { formatWon, formatDate } from "@/lib/format";

interface SheetResponse {
  people: Person[];
  items: Item[];
  cells: Cell[];
  basisPersonId: number | null;
  settlement: SettlementResult[];
}

const cellKey = (itemId: number, personId: number) => `${itemId}:${personId}`;

export default function Home() {
  const [data, setData] = useState<SheetResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  // 새로 추가된 사람/항목 입력칸에 자동 포커스 (예: "person-5", "item-3")
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  // 저장된 정산 내역
  const [saved, setSaved] = useState<SavedSettlement[]>([]);
  const [viewing, setViewing] = useState<SavedSettlement | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 콜백 ref: 대상 입력칸이 렌더되면 포커스 + 전체 선택
  const focusRef = useCallback(
    (el: HTMLInputElement | null, target: string) => {
      if (el && focusTarget === target) {
        el.focus();
        el.select();
        setFocusTarget(null);
      }
    },
    [focusTarget]
  );

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/sheet", { cache: "no-store" });
    if (!res.ok) {
      showToast("데이터를 불러오지 못했습니다.", true);
      return;
    }
    const json: SheetResponse = await res.json();
    setData(json);
    // 셀 draft 동기화
    const d: Record<string, string> = {};
    for (const c of json.cells) d[cellKey(c.itemId, c.personId)] = String(c.amount);
    setDraft(d);
  }, [showToast]);

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/settlements", { cache: "no-store" });
    if (!res.ok) return;
    setSaved(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    loadSaved();
  }, [refresh, loadSaved]);

  const api = useCallback(
    async (url: string, method: string, body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error || "요청에 실패했습니다.", true);
        throw new Error(j.error || "request failed");
      }
      return res.json();
    },
    [showToast]
  );

  // ---- 셀 ----
  const onCellChange = (itemId: number, personId: number, value: string) => {
    setDraft((d) => ({ ...d, [cellKey(itemId, personId)]: value }));
  };

  const commitCell = async (itemId: number, personId: number) => {
    const key = cellKey(itemId, personId);
    const raw = draft[key] ?? "";
    const original = data?.cells.find(
      (c) => c.itemId === itemId && c.personId === personId
    );
    const originalStr = original ? String(original.amount) : "";
    if (raw.trim() === originalStr.trim()) return; // 변화 없음
    try {
      await api("/api/cells", "PUT", {
        itemId,
        personId,
        amount: raw.trim() === "" ? null : raw,
      });
      await refresh();
    } catch {
      /* toast 처리됨 */
    }
  };

  // ---- 이름/항목 ----
  const renamePerson = async (id: number, name: string, current: string) => {
    if (name.trim() === current || !name.trim()) return;
    try {
      await api(`/api/people/${id}`, "PATCH", { name });
      await refresh();
    } catch {}
  };

  const renameItem = async (id: number, name: string, current: string) => {
    if (name.trim() === current || !name.trim()) return;
    try {
      await api(`/api/items/${id}`, "PATCH", { name });
      await refresh();
    } catch {}
  };

  const addPerson = async () => {
    try {
      const created = await api("/api/people", "POST", { name: "새 인원" });
      setFocusTarget(`person-${created.id}`);
      await refresh();
    } catch {}
  };

  const addItem = async () => {
    try {
      const created = await api("/api/items", "POST", { name: "새 항목" });
      setFocusTarget(`item-${created.id}`);
      await refresh();
    } catch {}
  };

  const deletePerson = async (id: number) => {
    try {
      await api(`/api/people/${id}`, "DELETE");
      await refresh();
    } catch {}
  };

  const deleteItem = async (id: number) => {
    try {
      await api(`/api/items/${id}`, "DELETE");
      await refresh();
    } catch {}
  };

  const setBasis = async (id: number) => {
    const next = data?.basisPersonId === id ? null : id;
    try {
      await api("/api/settings", "PUT", { basisPersonId: next });
      await refresh();
    } catch {}
  };

  const createSnapshot = async () => {
    if (savingSnapshot) return;
    setSavingSnapshot(true);
    try {
      await api("/api/settlements", "POST", { title: snapshotTitle.trim() });
      setSnapshotTitle("");
      await loadSaved();
      showToast("정산 내역이 저장되었습니다.");
    } catch {
    } finally {
      setSavingSnapshot(false);
    }
  };

  const deleteSnapshot = async (id: number) => {
    try {
      await api(`/api/settlements/${id}`, "DELETE");
      if (viewing?.id === id) setViewing(null);
      await loadSaved();
    } catch {}
  };

  const resetSheet = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await api("/api/reset", "POST");
      await refresh();
      showToast("시트를 초기화했습니다.");
    } catch {
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("공유 링크가 복사되었습니다.");
    } catch {
      // 클립보드 권한이 없으면 링크를 토스트로 노출
      showToast(url);
    }
  };

  const restoreSnapshot = async (id: number) => {
    if (restoring) return;
    setRestoring(true);
    try {
      await api(`/api/settlements/${id}/restore`, "POST");
      await refresh();
      setViewing(null);
      showToast("저장된 값으로 시트를 채웠습니다.");
    } catch {
    } finally {
      setRestoring(false);
    }
  };

  const basisName = useMemo(() => {
    if (!data || data.basisPersonId == null) return null;
    return data.people.find((p) => p.id === data.basisPersonId)?.name ?? null;
  }, [data]);

  if (!data) {
    return (
      <div className="page">
        <p className="empty-note">불러오는 중…</p>
      </div>
    );
  }

  const { people, items, basisPersonId, settlement } = data;

  return (
    <div className="page">
      <header className="page-header">
        <h1>💸 정산 시트</h1>
        <p>
          항목별로 각자 낸 금액을 입력하면, 정산기준 인원에게 누가 얼마를 입금해야
          하는지 자동으로 계산합니다.
        </p>
      </header>

      {/* ---------- 시트 ---------- */}
      <div className="card" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
        <div className="sheet-toolbar">
          {confirmReset ? (
            <>
              <span className="reset-confirm-text">
                현재 시트를 모두 비울까요? (저장된 내역은 유지됩니다)
              </span>
              <button
                className="btn danger"
                onClick={resetSheet}
                disabled={resetting}
              >
                {resetting ? "초기화 중…" : "초기화"}
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                취소
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirmReset(true)}>
              🗑 초기화
            </button>
          )}
        </div>
        <div className="sheet-scroll">
          <table className="sheet">
            <thead>
              <tr>
                <th className="corner">
                  <div className="corner-inner">항목</div>
                </th>
                {people.map((p) => {
                  const isBasis = p.id === basisPersonId;
                  return (
                    <th key={p.id} className={`col-head${isBasis ? " basis" : ""}`}>
                      <div className="head-actions">
                        <button
                          className={`basis-btn${isBasis ? " active" : ""}`}
                          title={isBasis ? "정산기준 해제" : "정산기준으로 지정"}
                          onClick={() => setBasis(p.id)}
                        >
                          {isBasis ? "⭐" : "☆"}
                        </button>
                        <button
                          className="del-btn"
                          title="삭제"
                          onClick={() => deletePerson(p.id)}
                        >
                          ×
                        </button>
                      </div>
                      <input
                        defaultValue={p.name}
                        key={`name-${p.id}-${p.name}`}
                        ref={(el) => focusRef(el, `person-${p.id}`)}
                        onBlur={(e) => renamePerson(p.id, e.target.value, p.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                      {isBasis && <div className="basis-tag">정산기준</div>}
                    </th>
                  );
                })}
                <th className="add-col">
                  <button
                    className="add-cell-btn"
                    title="사람 추가"
                    onClick={addPerson}
                  >
                    +
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th className="row-head">
                    <button
                      className="del-btn"
                      title="항목 삭제"
                      style={{ position: "absolute", right: 4, top: 6 }}
                      onClick={() => deleteItem(item.id)}
                    >
                      ×
                    </button>
                    <input
                      defaultValue={item.name}
                      key={`item-${item.id}-${item.name}`}
                      ref={(el) => focusRef(el, `item-${item.id}`)}
                      onBlur={(e) => renameItem(item.id, e.target.value, item.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </th>
                  {people.map((p) => {
                    const key = cellKey(item.id, p.id);
                    const isBasisCol = p.id === basisPersonId;
                    return (
                      <td key={p.id} className={`cell${isBasisCol ? " basis-col" : ""}`}>
                        <input
                          inputMode="decimal"
                          placeholder="-"
                          value={draft[key] ?? ""}
                          onChange={(e) => onCellChange(item.id, p.id, e.target.value)}
                          onBlur={() => commitCell(item.id, p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="add-col-spacer" />
                </tr>
              ))}
              <tr>
                <th className="row-head add-row-head">
                  <button
                    className="add-cell-btn wide"
                    title="항목 추가"
                    onClick={addItem}
                  >
                    + 항목 추가
                  </button>
                </th>
                <td className="add-col-spacer" colSpan={people.length + 1} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- 정산 결과 ---------- */}
      <div className="card">
        <div className="card-head-row">
          <h2 className="card-title">📊 정산 결과</h2>
          <div className="snapshot-create">
            <input
              className="snapshot-input"
              placeholder="정산 이름 (예: 6월 제주여행)"
              value={snapshotTitle}
              onChange={(e) => setSnapshotTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createSnapshot();
              }}
            />
            <button
              className="btn primary"
              onClick={createSnapshot}
              disabled={savingSnapshot}
            >
              {savingSnapshot ? "저장 중…" : "💾 정산 데이터 생성"}
            </button>
          </div>
        </div>
        {basisName ? (
          <p className="basis-line">
            정산기준: <strong>{basisName}</strong> · 각 인원이 {basisName}에게
            입금할 금액
          </p>
        ) : (
          <p className="basis-line">
            정산기준이 지정되지 않았습니다. 위 표 헤더의 ☆ 를 눌러 기준 인원을
            선택하세요.
          </p>
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

      {/* ---------- 저장된 정산 내역 ---------- */}
      <div className="card">
        <h2 className="card-title">🗂️ 저장된 정산 내역</h2>
        {saved.length === 0 ? (
          <p className="empty-note">
            아직 저장된 내역이 없습니다. 위의 「정산 데이터 생성」을 누르면 현재
            정산 결과가 기록으로 저장됩니다.
          </p>
        ) : (
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.id} className="saved-item">
                <button className="saved-main" onClick={() => setViewing(s)}>
                  <span className="saved-title">{s.title}</span>
                  <span className="saved-meta">
                    {formatDate(s.createdAt)} · 기준{" "}
                    {s.data.basisName ?? "미지정"} · 인원 {s.data.people.length}명
                  </span>
                </button>
                <a
                  className="saved-action"
                  href={`/share/${s.shareToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="공유 페이지 열기"
                >
                  열기 ↗
                </a>
                <button
                  className="saved-action"
                  title="공유 링크 복사"
                  onClick={() => copyShareLink(s.shareToken)}
                >
                  🔗 공유
                </button>
                <button
                  className="del-btn-visible"
                  title="내역 삭제"
                  onClick={() => deleteSnapshot(s.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- 내역 상세 모달 ---------- */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 className="modal-title">{viewing.title}</h3>
                <p className="modal-sub">
                  {formatDate(viewing.createdAt)} · 정산기준{" "}
                  <strong>{viewing.data.basisName ?? "미지정"}</strong>
                </p>
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => copyShareLink(viewing.shareToken)}
                >
                  🔗 공유 링크 복사
                </button>
                <button
                  className="btn primary"
                  onClick={() => restoreSnapshot(viewing.id)}
                  disabled={restoring}
                >
                  {restoring ? "적용 중…" : "↩ 재정산하기"}
                </button>
                <button className="btn" onClick={() => setViewing(null)}>
                  닫기
                </button>
              </div>
            </div>
            <p className="modal-hint">
              「재정산하기」를 누르면 이 시점의 인원·항목·금액으로 현재 시트를 다시
              채웁니다. (현재 입력값은 덮어쓰여집니다)
            </p>

            <table className="snapshot-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>낸 돈</th>
                  <th>부담액</th>
                  <th>정산</th>
                </tr>
              </thead>
              <tbody>
                {viewing.data.settlement.map((r) => {
                  const isBasis = r.personId === viewing.data.basisPersonId;
                  const pay = r.payToBasis;
                  const label = isBasis
                    ? "정산 받는 사람"
                    : pay > 0
                    ? `${formatWon(pay)} 입금`
                    : pay < 0
                    ? `${formatWon(-pay)} 환급`
                    : "정산 완료";
                  const cls = isBasis
                    ? "settled"
                    : pay > 0
                    ? "pay"
                    : pay < 0
                    ? "refund"
                    : "settled";
                  return (
                    <tr key={r.personId} className={isBasis ? "is-basis-row" : ""}>
                      <td>
                        {r.name}
                        {isBasis && <span className="basis-tag"> 기준</span>}
                      </td>
                      <td className="num">{formatWon(r.paid)}</td>
                      <td className="num">{formatWon(r.owed)}</td>
                      <td className={`num strong ${cls}`}>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}
