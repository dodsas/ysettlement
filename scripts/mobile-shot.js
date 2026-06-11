const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  // iPhone 16: 393x852 logical, DSR 3
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // 1) 전체 페이지
  await page.screenshot({ path: "/tmp/m-full.png", fullPage: true });

  // 2) 상단(헤더+시트) 뷰포트
  await page.screenshot({ path: "/tmp/m-top.png" });

  // 3) 출발지 자동완성 드롭다운
  const start = page.locator(".route-form .addr-field input").first();
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/tmp/m-addr.png" });
    await page.keyboard.press("Escape");
    await page.mouse.click(10, 10);
    await page.waitForTimeout(200);
  }

  // 4) 저장 내역 모달
  const savedMain = page.locator(".saved-main").first();
  if (await savedMain.count()) {
    await savedMain.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "/tmp/m-modal.png" });
  }

  console.log("done");
  await browser.close();
})();
