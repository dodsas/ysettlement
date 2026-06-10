export interface Person {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  name: string;
}

/** 셀: item_id-person_id 조합의 금액. 값이 없는(빈) 칸은 cells 배열에 포함되지 않는다. */
export interface Cell {
  itemId: number;
  personId: number;
  amount: number;
}

export interface SheetData {
  people: Person[];
  items: Item[];
  cells: Cell[];
  /** 정산기준이 되는 사람 id (없으면 null) */
  basisPersonId: number | null;
}

/** 저장 시점의 시트 + 정산결과 스냅샷 (settlements.data 에 JSON 으로 저장) */
export interface SettlementSnapshot extends SheetData {
  basisName: string | null;
  settlement: SettlementResult[];
}

/** 저장된 정산 내역 레코드 */
export interface SavedSettlement {
  id: number;
  title: string;
  createdAt: string;
  /** 공유 URL 용 추측 불가능한 토큰 */
  shareToken: string;
  data: SettlementSnapshot;
}

/** 각 사람의 정산 결과 */
export interface SettlementResult {
  personId: number;
  name: string;
  /** 실제로 낸 돈 합계 */
  paid: number;
  /** 부담해야 하는 금액 합계(균등 분배 기준) */
  owed: number;
  /** 순수지 = paid - owed (양수면 더 냈음, 음수면 덜 냈음) */
  net: number;
  /**
   * 정산기준(허브) 인원에게 입금해야 하는 금액 = owed - paid.
   * 양수면 기준에게 입금, 음수면 기준이 돌려줘야 함(환급).
   */
  payToBasis: number;
}
