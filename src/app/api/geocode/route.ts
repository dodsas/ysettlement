import { NextResponse } from "next/server";
import { searchAddress, searchPlace, type Candidate } from "@/lib/naverMaps";

export const dynamic = "force-dynamic";

// 장소명/주소 검색 -> 후보 목록 (자동완성 셀렉트 박스용)
// 장소(지역검색) 결과를 먼저, 그다음 주소(지오코딩) 결과를 합친다.
export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams.get("query")?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json({ candidates: [] });
    }

    // 두 검색을 병렬로. 한쪽이 실패해도 다른 쪽 결과는 살린다.
    const [places, addresses] = await Promise.all([
      searchPlace(query).catch(() => [] as Candidate[]),
      searchAddress(query).catch(() => [] as Candidate[]),
    ]);

    // 좌표 없는 후보 제외 + 중복(같은 label) 제거
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const c of [...places, ...addresses]) {
      if (!c.x || !c.y) continue;
      const key = `${c.label}|${c.sub}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(c);
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
