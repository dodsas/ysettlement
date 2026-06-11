"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Person,
  Item,
  Cell,
  SettlementResult,
  SavedSettlement,
  SavedSettlementSummary,
  FavoriteLocation,
  RecentLocation,
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

interface Candidate {
  label: string;
  sub: string;
  x: string;
  y: string;
  kind: "place" | "address";
}

type Coord = { x: string; y: string } | null;

/** 주소 자동완성 입력칸: 대충 입력하면 후보를 드롭다운으로 보여주고 선택하면 좌표까지 확정.
 *  favorites/recents 가 주어지면 빈 상태에서 즐겨찾기·최근 위치를 보여주고,
 *  ⭐ 버튼으로 현재 위치를 별칭과 함께 즐겨찾기에 저장할 수 있다. */
function AddressField({
  placeholder,
  onChange,
  favorites,
  recents,
  onSaveFavorite,
  onDeleteFavorite,
}: {
  placeholder: string;
  onChange: (text: string, coord: Coord) => void;
  favorites?: FavoriteLocation[];
  recents?: RecentLocation[];
  onSaveFavorite?: (alias: string, label: string, coord: Coord) => void;
  onDeleteFavorite?: (id: number) => void;
}) {
  const [text, setText] = useState("");
  const [coord, setCoord] = useState<Coord>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMemory = Boolean(favorites?.length || recents?.length);
  const hasQuery = text.trim().length >= 2;

  const pick = (label: string, c: Coord) => {
    setText(label);
    setCoord(c);
    onChange(label, c);
    setOpen(false);
  };

  const runSearch = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(hasMemory); // 검색어 없으면 즐겨찾기/최근 표시
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const res = await fetch(`/api/geocode?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(res.ok && Array.isArray(data.candidates) ? data.candidates : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const saveFavorite = () => {
    if (!onSaveFavorite || !text.trim()) return;
    const alias = window.prompt(`'${text}' 의 별칭을 입력하세요. (예: 집, 회사)`);
    if (alias && alias.trim()) onSaveFavorite(alias.trim(), text.trim(), coord);
  };

  return (
    <div className="addr-field">
      <input
        className={`route-input${onSaveFavorite ? " has-fav" : ""}`}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCoord(null);
          onChange(e.target.value, null); // 직접 수정 시 좌표 해제(전송 시 재지오코딩)
          runSearch(e.target.value);
        }}
        onFocus={() => setOpen(hasQuery ? results.length > 0 : hasMemory)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {onSaveFavorite && text.trim() && (
        <button
          className="addr-fav-btn"
          title="즐겨찾기에 별칭으로 저장"
          onMouseDown={(e) => {
            e.preventDefault();
            saveFavorite();
          }}
        >
          ☆
        </button>
      )}
      {open && (
        <ul className="addr-dropdown">
          {hasQuery ? (
            <>
              {loading && <li className="addr-msg">검색 중…</li>}
              {!loading && results.length === 0 && (
                <li className="addr-msg">결과 없음</li>
              )}
              {results.map((r, i) => (
                <li
                  key={i}
                  className="addr-option"
                  onMouseDown={() => pick(r.label, { x: r.x, y: r.y })}
                >
                  <span className="addr-road">
                    {r.kind === "place" && <span className="addr-pin">📍</span>}
                    {r.label}
                  </span>
                  {r.sub && <span className="addr-jibun">{r.sub}</span>}
                </li>
              ))}
            </>
          ) : (
            <>
              {favorites && favorites.length > 0 && (
                <li className="addr-group">⭐ 즐겨찾기</li>
              )}
              {favorites?.map((f) => (
                <li
                  key={`f-${f.id}`}
                  className="addr-option"
                  onMouseDown={() => {
                    const hasCoord = Boolean(f.x && f.y);
                    // 좌표가 있으면 별칭을 표시(좌표로 계산), 없으면 주소를 표시(지오코딩)
                    pick(
                      hasCoord ? f.alias : f.label,
                      hasCoord ? { x: f.x, y: f.y } : null
                    );
                  }}
                >
                  <span className="addr-road">
                    <span className="addr-pin">⭐</span>
                    {f.alias}
                  </span>
                  <span className="addr-jibun">{f.label}</span>
                  {onDeleteFavorite && (
                    <button
                      className="addr-del"
                      title="즐겨찾기 삭제"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteFavorite(f.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
              {recents && recents.length > 0 && (
                <li className="addr-group">🕘 최근</li>
              )}
              {recents?.map((r, i) => (
                <li
                  key={`r-${i}`}
                  className="addr-option"
                  onMouseDown={() =>
                    pick(r.label, r.x && r.y ? { x: r.x, y: r.y } : null)
                  }
                >
                  <span className="addr-road">🕘 {r.label}</span>
                </li>
              ))}
              {!hasMemory && <li className="addr-msg">최근·즐겨찾기 없음</li>}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function draftFromCells(cells: Cell[]): Record<string, string> {
  const d: Record<string, string> = {};
  for (const c of cells) d[cellKey(c.itemId, c.personId)] = String(c.amount);
  return d;
}

interface SheetAppProps {
  initialSheet: SheetResponse;
  initialSaved: SavedSettlementSummary[];
}

export default function SheetApp({ initialSheet, initialSaved }: SheetAppProps) {
  // 서버에서 받은 초기 데이터로 즉시 렌더("불러오는 중" 없음)
  const [data, setData] = useState<SheetResponse | null>(initialSheet);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    draftFromCells(initialSheet.cells)
  );
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  // 새로 추가된 사람/항목 입력칸에 자동 포커스 (예: "person-5", "item-3")
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  // 저장된 정산 내역
  const [saved, setSaved] = useState<SavedSettlementSummary[]>(initialSaved);
  const [viewing, setViewing] = useState<SavedSettlement | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  // 모바일 추가 입력 모달
  const [addModal, setAddModal] = useState<"item" | "person" | null>(null);
  const [addModalValue, setAddModalValue] = useState("");
  // 경로 비용 자동 계산(네이버 지도)
  const [routeStart, setRouteStart] = useState("");
  const [routeGoal, setRouteGoal] = useState("");
  const [routeStartCoord, setRouteStartCoord] = useState<Coord>(null);
  const [routeGoalCoord, setRouteGoalCoord] = useState<Coord>(null);
  const [routePayer, setRoutePayer] = useState<number | "">("");
  const [routeBusy, setRouteBusy] = useState(false);
  // 즐겨찾기 / 최근 위치
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [recents, setRecents] = useState<RecentLocation[]>([]);
  const [routeResult, setRouteResult] = useState<{
    fuelPrice: number;
    tollFare: number;
    distance: number;
    startLabel: string;
    goalLabel: string;
  } | null>(null);

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
    setDraft(draftFromCells(json.cells));
  }, [showToast]);

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/settlements", { cache: "no-store" });
    if (!res.ok) return;
    setSaved(await res.json());
  }, []);

  const loadLocations = useCallback(async () => {
    const res = await fetch("/api/locations", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setFavorites(data.favorites ?? []);
    setRecents(data.recents ?? []);
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

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
    if (!data) return;
    const key = cellKey(itemId, personId);
    const raw = draft[key] ?? "";
    const original = data.cells.find(
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
      // 금액을 입력(비우는 게 아닌)했으면 같은 행의 '빈 칸' 인원을 0으로 자동 채움
      // → 그 항목을 전원 분담으로 설정. (이미 값이 있는 칸은 그대로 둠)
      if (raw.trim() !== "") {
        const fills = data.people.filter((p) => {
          if (p.id === personId) return false;
          const ck = cellKey(itemId, p.id);
          const hasCommitted = data.cells.some(
            (c) => c.itemId === itemId && c.personId === p.id
          );
          const hasDraft = (draft[ck] ?? "").trim() !== "";
          return !hasCommitted && !hasDraft;
        });
        await Promise.all(
          fills.map((p) =>
            api("/api/cells", "PUT", {
              itemId,
              personId: p.id,
              amount: 0,
            })
          )
        );
      }
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

  // 데스크톱(표 안 + 버튼): 기본 이름으로 생성 후 인라인 포커스
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

  // 모바일(툴바 + 버튼): 입력 모달에서 이름을 받아 생성
  const submitAddModal = async () => {
    const name = addModalValue.trim();
    if (!name || !addModal) {
      setAddModal(null);
      return;
    }
    const url = addModal === "item" ? "/api/items" : "/api/people";
    try {
      await api(url, "POST", { name });
      setAddModal(null);
      setAddModalValue("");
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

  // 목록은 요약만 갖고 있으므로, 상세(모달)는 클릭 시 data 포함 단건을 조회
  const openViewing = async (id: number) => {
    try {
      const full = await api(`/api/settlements/${id}`, "GET");
      setViewing(full);
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

  const calcRouteCost = async () => {
    if (routeBusy) return;
    if (!routeStart.trim() || !routeGoal.trim()) {
      showToast("출발지와 도착지를 입력하세요.", true);
      return;
    }
    if (routePayer === "") {
      showToast("결제자를 선택하세요.", true);
      return;
    }
    setRouteBusy(true);
    try {
      const res = await api("/api/route-cost", "POST", {
        start: routeStart.trim(),
        goal: routeGoal.trim(),
        startX: routeStartCoord?.x,
        startY: routeStartCoord?.y,
        goalX: routeGoalCoord?.x,
        goalY: routeGoalCoord?.y,
        payerId: routePayer,
      });
      setRouteResult(res);
      await refresh();
      await loadLocations(); // 최근 위치 갱신
      showToast(
        `유류비 ${formatWon(res.fuelPrice)} · 통행료 ${formatWon(
          res.tollFare
        )} 반영됨`
      );
    } catch {
    } finally {
      setRouteBusy(false);
    }
  };

  const saveFavorite = async (alias: string, label: string, coord: Coord) => {
    try {
      await api("/api/locations", "POST", {
        alias,
        label,
        x: coord?.x,
        y: coord?.y,
      });
      await loadLocations();
      showToast(`즐겨찾기 '${alias}' 저장됨`);
    } catch {}
  };

  const deleteFavorite = async (id: number) => {
    try {
      await api(`/api/locations/${id}`, "DELETE");
      await loadLocations();
    } catch {}
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
          {/* 모바일에서는 추가 버튼을 표 위 툴바로 노출(표 안 추가열은 화면 밖으로 잘리므로) */}
          <div className="toolbar-left">
            <button
              className="btn mobile-add"
              onClick={() => {
                setAddModalValue("");
                setAddModal("item");
              }}
            >
              + 항목
            </button>
            <button
              className="btn mobile-add"
              onClick={() => {
                setAddModalValue("");
                setAddModal("person");
              }}
            >
              + 사람
            </button>
          </div>
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
          <table
            className={`sheet${people.length === 0 ? " is-empty" : ""}`}
            style={{ minWidth: Math.max(320, 140 + people.length * 104) }}
          >
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
                          if (e.key === "Enter" && !e.nativeEvent.isComposing)
                            (e.target as HTMLInputElement).blur();
                        }}
                      />
                      <div
                        className="basis-tag"
                        style={{ visibility: isBasis ? "visible" : "hidden" }}
                      >
                        정산기준
                      </div>
                    </th>
                  );
                })}
                <th className="add-col">
                  <button
                    className="add-cell-btn add-person"
                    title="사람 추가"
                    onClick={addPerson}
                  >
                    <span className="add-plus">+</span>
                    <span className="add-label-text">사람 추가</span>
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
                        if (e.key === "Enter" && !e.nativeEvent.isComposing)
                          (e.target as HTMLInputElement).blur();
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
                            if (e.key === "Enter" && !e.nativeEvent.isComposing)
                            (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="add-col-spacer" />
                </tr>
              ))}
              <tr className="add-item-row">
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

        {/* ---------- 모바일 카드 레이아웃 ---------- */}
        <div className="sheet-mobile">
          {people.length > 0 && (
            <div className="m-people">
              {people.map((p) => {
                const isBasis = p.id === basisPersonId;
                return (
                  <div key={p.id} className={`m-chip${isBasis ? " basis" : ""}`}>
                    <button
                      className="m-chip-star"
                      title={isBasis ? "정산기준 해제" : "정산기준으로 지정"}
                      onClick={() => setBasis(p.id)}
                    >
                      {isBasis ? "⭐" : "☆"}
                    </button>
                    <input
                      defaultValue={p.name}
                      key={`m-name-${p.id}-${p.name}`}
                      onBlur={(e) => renamePerson(p.id, e.target.value, p.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing)
                          (e.target as HTMLInputElement).blur();
                      }}
                    />
                    <button
                      className="m-chip-del"
                      title="삭제"
                      onClick={() => deletePerson(p.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 모바일: 새로 추가한 항목이 맨 위에 보이도록 최신순(역순) 표시 */}
          {items
            .slice()
            .reverse()
            .map((item) => (
            <div key={item.id} className="m-item">
              <div className="m-item-head">
                <input
                  defaultValue={item.name}
                  key={`m-item-${item.id}-${item.name}`}
                  onBlur={(e) => renameItem(item.id, e.target.value, item.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing)
                      (e.target as HTMLInputElement).blur();
                  }}
                />
                <button
                  className="m-item-del"
                  title="항목 삭제"
                  onClick={() => deleteItem(item.id)}
                >
                  ×
                </button>
              </div>
              {people.length === 0 ? (
                <div className="m-empty-note">위에서 인원을 먼저 추가하세요.</div>
              ) : (
                <div className="m-rows">
                  {people.map((p) => {
                    const key = cellKey(item.id, p.id);
                    const isBasis = p.id === basisPersonId;
                    return (
                      <div key={p.id} className="m-row">
                        <span className="m-row-name">
                          {p.name}
                          {isBasis && <span className="m-basis-dot">기준</span>}
                        </span>
                        <input
                          inputMode="decimal"
                          placeholder="-"
                          value={draft[key] ?? ""}
                          onChange={(e) => onCellChange(item.id, p.id, e.target.value)}
                          onBlur={() => commitCell(item.id, p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing)
                              (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <span className="m-row-won">원</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="m-empty-note">위 「+ 항목」으로 항목을 추가하세요.</div>
          )}
        </div>
      </div>

      {/* ---------- 경로 비용 자동 계산 ---------- */}
      <div className="card">
        <h2 className="card-title">🚗 경로 비용 자동 계산 (네이버 지도)</h2>
        <p className="basis-line" style={{ marginBottom: 14 }}>
          출발지·도착지를 입력하면 <strong>왕복 기준</strong> 예상{" "}
          <strong>유류비</strong>·<strong>통행료</strong>를 계산해, 결제자 칸엔
          전액·나머지 인원 칸엔 0(균등 분담)으로 시트에 채웁니다.
        </p>
        <div className="route-form">
          <AddressField
            placeholder="출발지 (예: 경인로605)"
            onChange={(t, c) => {
              setRouteStart(t);
              setRouteStartCoord(c);
            }}
            favorites={favorites}
            recents={recents}
            onSaveFavorite={saveFavorite}
            onDeleteFavorite={deleteFavorite}
          />
          <span className="route-arrow">→</span>
          <AddressField
            placeholder="도착지 (예: 의왕호수공원)"
            onChange={(t, c) => {
              setRouteGoal(t);
              setRouteGoalCoord(c);
            }}
          />
          <select
            className="route-select"
            value={routePayer}
            onChange={(e) =>
              setRoutePayer(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">결제자 선택</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="btn primary"
            onClick={calcRouteCost}
            disabled={routeBusy || people.length === 0}
          >
            {routeBusy ? "계산 중…" : "계산 후 추가"}
          </button>
        </div>
        {people.length === 0 && (
          <p className="empty-note" style={{ marginTop: 10 }}>
            먼저 시트에 사람을 추가하세요.
          </p>
        )}
        {routeResult && (
          <div className="route-result">
            <span>
              왕복: {routeResult.startLabel} ↔ {routeResult.goalLabel}
            </span>
            <span>
              왕복 거리 {(routeResult.distance / 1000).toFixed(1)}km · 유류비{" "}
              <strong>{formatWon(routeResult.fuelPrice)}</strong> · 통행료{" "}
              <strong>{formatWon(routeResult.tollFare)}</strong>
            </span>
          </div>
        )}
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
                if (e.key === "Enter" && !e.nativeEvent.isComposing) createSnapshot();
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
                <button className="saved-main" onClick={() => openViewing(s.id)}>
                  <span className="saved-title">{s.title}</span>
                  <span className="saved-meta">
                    {formatDate(s.createdAt)} · 기준 {s.basisName ?? "미지정"} ·
                    인원 {s.peopleCount}명
                  </span>
                </button>
                <div className="saved-actions">
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
                </div>
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

      {/* 모바일 추가 입력 모달 */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(null)}>
          <div
            className="modal add-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">
              {addModal === "item" ? "항목 추가" : "사람 추가"}
            </h3>
            <input
              className="add-modal-input"
              autoFocus
              placeholder={
                addModal === "item" ? "항목 이름 (예: 숙소비)" : "이름 (예: 영희)"
              }
              value={addModalValue}
              onChange={(e) => setAddModalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  submitAddModal();
              }}
            />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setAddModal(null)}>
                취소
              </button>
              <button className="btn primary" onClick={submitAddModal}>
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}
