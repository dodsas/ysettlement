const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1100, height: 800 } }).then((c) => c.newPage());
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 첫 항목 행의 첫 번째 인원 셀에 금액 입력 후 Enter
  const firstCell = page.locator("tbody tr").first().locator("td.cell input").first();
  await firstCell.click();
  await firstCell.fill("30000");
  await firstCell.press("Enter");
  await page.waitForTimeout(1200);

  // 같은 행 모든 셀의 현재 표시값 읽기
  const values = await page
    .locator("tbody tr")
    .first()
    .locator("td.cell input")
    .evaluateAll((els) => els.map((e) => e.value));
  console.log("ROW_VALUES=" + JSON.stringify(values));

  await browser.close();
})();
