import SheetApp from "./sheet-app";
import { loadSheet, listSavedSettlements } from "@/lib/sheet";
import { calculateSettlement } from "@/lib/settlement";

// 매 요청마다 최신 데이터를 서버에서 렌더링(초기 로딩 워터폴 제거)
export const dynamic = "force-dynamic";

export default async function Home() {
  const [sheet, saved] = await Promise.all([
    loadSheet(),
    listSavedSettlements(),
  ]);
  const settlement = calculateSettlement(sheet);

  return (
    <SheetApp
      initialSheet={{ ...sheet, settlement }}
      initialSaved={saved}
    />
  );
}
