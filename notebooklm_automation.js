import express from "express";
import fetch from "node-fetch";
import { chromium } from "playwright";
import { execSync } from "child_process";        // ← NEW

const app = express();
app.use(express.json());
app.use((_, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });

/* ---------- ensure a Playwright browser is present ----------------------- */
async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (e) {
    if (String(e).includes("Executable doesn't exist")) {
      console.log("▶ Playwright browsers missing – downloading Chromium …");
      execSync("npx playwright install chromium", { stdio: "inherit" });
      return await chromium.launch({ headless: true });
    }
    throw e;          // other errors propagate
  }
}
/* ------------------------------------------------------------------------ */

async function downloadPDF(url) {
  const r = await fetch(url, { timeout: 25000 });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return {
    name: url.split("/").pop().replace(/\?.*$/, "") || "paper.pdf",
    mimeType: "application/pdf",
    buffer: await r.buffer()
  };
}

app.post("/uploadAndSummarize", async (req, res) => {
  const urls = (req.body.pdfUrls || []).filter(u => u.endsWith(".pdf"));
  if (!urls.length) return res.json({ status: "error", error: "No valid PDF URLs" });

  const browser = await launchBrowser();               // ← CHANGED
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  try {
    await page.goto("https://notebooklm.google.com");
    await page.waitForSelector('input[type="file"]', { timeout: 0 });

    const files = await Promise.all(urls.map(downloadPDF));
    const upload = await page.$('input[type="file"]');
    await upload.setInputFiles(files);

    await page.waitForSelector('button[aria-label="Summarize"]', { timeout: 12000 });
    await page.click('button[aria-label="Summarize"]');
    await page.waitForTimeout(6000);

    const summaries = await page.$$eval('[data-testid="source-summary-card"]', cards =>
      cards.map(c => ({
        title:   c.querySelector("h3")?.innerText ?? "Untitled",
        summary: c.querySelector("div")?.innerText ?? ""
      }))
    );

    res.json({ status: "success", summaries });
  } catch (e) {
    console.error("Playwright error:", e);
    res.json({ status: "error", error: e.message });
  } finally {
    await context.tracing.stop({ path: "trace.zip" });
    setTimeout(() => browser.close(), 30000);
  }
});

app.listen(3000, () => console.log("⇢  http://localhost:3000  (Playwright broker)"));
