import type { SheetData, SettlementResult } from "./types";

/**
 * 정산 계산.
 *
 * 규칙:
 *  - 각 항목(행)에서 "값이 있는 셀"의 사람만 그 항목의 참여자다. (빈 칸 = 미참여, 0 = 참여했지만 0원 지불)
 *  - 항목 총액 = 참여자들이 낸 금액의 합. 이 총액을 참여자 수로 균등 분배한다.
 *  - 사람별 paid(낸 돈) / owed(부담액)를 모든 항목에 대해 누적한다.
 *  - 순수지 net = paid - owed.
 *  - 정산기준 인원을 허브로 삼는다. 각 사람이 기준에게 입금할 금액 payToBasis = owed - paid (= -net).
 *      payToBasis > 0  → 기준에게 입금해야 함
 *      payToBasis < 0  → 기준이 그 사람에게 환급해야 함
 *    기준 본인의 payToBasis 는 다른 모든 사람의 정산을 흡수하므로 별도로 받지 않는다(표시는 함).
 */
export function calculateSettlement(sheet: SheetData): SettlementResult[] {
  const { people, items, cells, basisPersonId } = sheet;

  const paid = new Map<number, number>();
  const owed = new Map<number, number>();
  for (const p of people) {
    paid.set(p.id, 0);
    owed.set(p.id, 0);
  }

  // 빠른 조회: itemId -> (personId -> amount)
  const byItem = new Map<number, Map<number, number>>();
  for (const c of cells) {
    let m = byItem.get(c.itemId);
    if (!m) {
      m = new Map();
      byItem.set(c.itemId, m);
    }
    m.set(c.personId, c.amount);
  }

  for (const item of items) {
    const m = byItem.get(item.id);
    if (!m || m.size === 0) continue;

    const participants = [...m.keys()];
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const share = total / participants.length;

    for (const personId of participants) {
      paid.set(personId, (paid.get(personId) ?? 0) + (m.get(personId) ?? 0));
      owed.set(personId, (owed.get(personId) ?? 0) + share);
    }
  }

  return people.map((p) => {
    const pPaid = round(paid.get(p.id) ?? 0);
    const pOwed = round(owed.get(p.id) ?? 0);
    const net = round(pPaid - pOwed);
    return {
      personId: p.id,
      name: p.name,
      paid: pPaid,
      owed: pOwed,
      net,
      payToBasis: p.id === basisPersonId ? 0 : round(pOwed - pPaid),
    };
  });
}

/** 원화는 정수로 반올림 (소수점 원 표기 방지). 잔여 차액은 정산기준이 흡수. */
function round(n: number): number {
  return Math.round(n);
}
