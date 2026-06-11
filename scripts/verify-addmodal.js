const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 툴바의 '+ 사람' 클릭 (모바일 add 버튼)
  await page.locator(".mobile-add", { hasText: "사람" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/m-addmodal.png" });

  // 모달 입력에 이름 타이핑 후 추가
  const input = page.locator(".add-modal-input");
  const visible = await input.isVisible().catch(() => false);
  console.log("MODAL_VISIBLE=" + visible);
  if (visible) {
    await input.fill("테스트인원");
    await page.locator(".add-modal .btn.primary").click();
    await page.waitForTimeout(900);
  }
  console.log("done");
  await browser.close();
})();
