import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "정산 시트",
  description: "함께 쓴 비용을 입력하면 누가 누구에게 얼마를 입금해야 하는지 정산해 줍니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
