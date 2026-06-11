/** 금액을 "1,234원" 형식으로 (음수는 앞에 -). 원화이므로 정수로 반올림. */
export function formatWon(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.round(Math.abs(n));
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

/** ISO 문자열을 "2026.06.10 17:18" 형식으로 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
