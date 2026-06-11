// 네이버 클라우드 플랫폼(NCP) Maps API 래퍼 (서버 전용)
// - Geocoding: 주소 -> 좌표
// - Directions: 좌표 -> 경로 요약(유류비 fuelPrice, 통행료 tollFare 등)

// 2025년 지도 API 콘솔/도메인 이전 후 신규 도메인. (구: naveropenapi.apigw.ntruss.com)
const BASE_URL =
  process.env.NCP_MAPS_BASE_URL || "https://maps.apigw.ntruss.com";

export interface RouteCost {
  fuelPrice: number; // 예상 유류비(원)
  tollFare: number; // 통행료(원)
  taxiFare: number; // 예상 택시요금(원)
  distance: number; // 거리(m)
  duration: number; // 소요시간(ms)
  startLabel: string; // 지오코딩된 출발지 도로명/지번
  goalLabel: string; // 지오코딩된 도착지 도로명/지번
}

function authHeaders(): Record<string, string> {
  const keyId = process.env.NCP_MAPS_KEY_ID;
  const key = process.env.NCP_MAPS_KEY;
  if (!keyId || !key) {
    throw new Error(
      "네이버 지도 API 키가 없습니다. .env 의 NCP_MAPS_KEY_ID / NCP_MAPS_KEY 를 설정하세요."
    );
  }
  return {
    "X-NCP-APIGW-API-KEY-ID": keyId,
    "X-NCP-APIGW-API-KEY": key,
    Accept: "application/json",
  };
}

interface GeocodeResult {
  x: string; // 경도(lng)
  y: string; // 위도(lat)
  label: string;
}

/** 자동완성 후보 (주소 또는 장소) */
export interface Candidate {
  label: string; // 주 표시: 장소명 또는 도로명주소
  sub: string; // 보조 표시: 주소
  x: string; // 경도(lng)
  y: string; // 위도(lat)
  kind: "place" | "address";
}

/** 위치 입력: 좌표(x,y)가 있으면 그대로 사용, 없으면 address 를 지오코딩 */
export interface LocationInput {
  address?: string;
  x?: string;
  y?: string;
}

/** 네이버 지역검색(Local Search) 키 보유 여부 */
export function hasPlaceSearch(): boolean {
  return Boolean(
    process.env.NAVER_SEARCH_CLIENT_ID && process.env.NAVER_SEARCH_CLIENT_SECRET
  );
}

/** 부분 주소로 일치 후보 목록 (NCP Geocoding) */
export async function searchAddress(query: string): Promise<Candidate[]> {
  const url = `${BASE_URL}/map-geocode/v2/geocode?query=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`주소 검색 실패(${res.status}). ${body}`);
  }
  const json = await res.json();
  const list = Array.isArray(json?.addresses) ? json.addresses : [];
  return list.map((a: Record<string, unknown>): Candidate => {
    const road = String(a.roadAddress || "");
    const jibun = String(a.jibunAddress || "");
    return {
      label: road || jibun,
      sub: road && jibun ? jibun : "",
      x: String(a.x ?? ""),
      y: String(a.y ?? ""),
      kind: "address",
    };
  });
}

/** 장소명으로 검색 (네이버 지역검색 Open API). 키 없으면 빈 배열. */
export async function searchPlace(query: string): Promise<Candidate[]> {
  const id = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!id || !secret) return [];

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
    query
  )}&display=5`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": id,
      "X-Naver-Client-Secret": secret,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`장소 검색 실패(${res.status}). ${body}`);
  }
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.map((it: Record<string, unknown>): Candidate => {
    const title = String(it.title || "").replace(/<\/?b>/g, ""); // <b> 태그 제거
    const road = String(it.roadAddress || "");
    const addr = String(it.address || "");
    // mapx/mapy 는 WGS84 좌표 × 10^7 (예: 1269770162 -> 126.9770162)
    const x = it.mapx ? String(Number(it.mapx) / 1e7) : "";
    const y = it.mapy ? String(Number(it.mapy) / 1e7) : "";
    return {
      label: title,
      sub: road || addr,
      x,
      y,
      kind: "place",
    };
  });
}

/** 위치 입력을 좌표로 해석 (좌표 우선, 없으면 지오코딩) */
async function resolveLocation(loc: LocationInput): Promise<GeocodeResult> {
  if (loc.x && loc.y) {
    return { x: loc.x, y: loc.y, label: loc.address || `${loc.x},${loc.y}` };
  }
  const address = (loc.address || "").trim();
  if (!address) throw new Error("출발지/도착지 정보가 없습니다.");
  const url = `${BASE_URL}/map-geocode/v2/geocode?query=${encodeURIComponent(
    address
  )}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`지오코딩 실패(${res.status}). 주소: "${address}" ${body}`);
  }
  const json = await res.json();
  const first = json?.addresses?.[0];
  if (!first) throw new Error(`주소를 찾을 수 없습니다: "${address}"`);
  return {
    x: String(first.x),
    y: String(first.y),
    label: String(first.roadAddress || first.jibunAddress || address),
  };
}

// 승용차 기준 연비(km/L). 네이버 Directions 의 mileage 파라미터로 전달.
const MILEAGE_KM_PER_L = 10;

interface DrivingSummary {
  fuelPrice: number;
  tollFare: number;
  taxiFare: number;
  distance: number;
  duration: number;
}

/** 좌표 두 지점 사이 단방향 주행 요약 (연비 10km/L 적용) */
async function drivingSummary(
  start: GeocodeResult,
  goal: GeocodeResult
): Promise<DrivingSummary> {
  const url =
    `${BASE_URL}/map-direction/v1/driving` +
    `?start=${start.x},${start.y}` +
    `&goal=${goal.x},${goal.y}` +
    `&option=traoptimal` +
    `&mileage=${MILEAGE_KM_PER_L}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`길찾기 실패(${res.status}). ${body}`);
  }
  const json = await res.json();
  if (json?.code !== undefined && json.code !== 0) {
    throw new Error(`길찾기 오류: ${json.message ?? json.code}`);
  }

  const route = json?.route ?? {};
  // 요청 옵션(traoptimal) 우선, 없으면 응답에 존재하는 첫 옵션 사용
  const optionKey = "traoptimal" in route ? "traoptimal" : Object.keys(route)[0];
  const summary = optionKey ? route[optionKey]?.[0]?.summary : undefined;
  if (!summary) {
    throw new Error("경로 요약 정보를 가져오지 못했습니다.");
  }
  return {
    fuelPrice: Number(summary.fuelPrice ?? 0),
    tollFare: Number(summary.tollFare ?? 0),
    taxiFare: Number(summary.taxiFare ?? 0),
    distance: Number(summary.distance ?? 0),
    duration: Number(summary.duration ?? 0),
  };
}

/**
 * 왕복 경로 비용 계산.
 * 정방향(출발→도착)과 역방향(도착→출발)을 각각 조회해 합산한다.
 * (방향별로 경로·일방통행료가 다를 수 있으므로 단순 2배가 아님)
 */
export async function getRoundTripCost(
  startLoc: LocationInput,
  goalLoc: LocationInput
): Promise<RouteCost> {
  const [start, goal] = await Promise.all([
    resolveLocation(startLoc),
    resolveLocation(goalLoc),
  ]);
  const [fwd, rev] = await Promise.all([
    drivingSummary(start, goal),
    drivingSummary(goal, start),
  ]);
  return {
    fuelPrice: fwd.fuelPrice + rev.fuelPrice,
    tollFare: fwd.tollFare + rev.tollFare,
    taxiFare: fwd.taxiFare + rev.taxiFare,
    distance: fwd.distance + rev.distance,
    duration: fwd.duration + rev.duration,
    startLabel: start.label,
    goalLabel: goal.label,
  };
}
