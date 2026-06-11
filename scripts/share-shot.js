const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const token = fs.readFileSync("/tmp/share-token.txt", "utf8").trim();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:3000/share/${token}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/m-share.png", fullPage: true });
  console.log("done");
  await browser.close();
})();
