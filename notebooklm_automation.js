import express from "express";
import fetch from "node-fetch";
import { chromium } from "playwright";
import cors from "cors";
import path from "path";
import os from "os";

const PORT       = 3000;
const UPLOAD_SEL = 'input[type="file"]';

// -------- detect system Chrome profile dir --------------------------------
function systemChromeProfile() {
  const h = os.homedir();
  if (process.platform === "darwin")
    return path.join(h, "Library/Application Support/Google/Chrome");
  if (process.platform === "win32")
    return path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/User Data");
  // linux
  return path.join(h, ".config/google-chrome");
}
// --------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());

async function launchCtx() {
  const chromeProfile = systemChromeProfile();
  try {
    // Try the real profile first (already signed in)
    return await chromium.launchPersistentContext(chromeProfile, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1280, height: 800 }
    });
  } catch (e) {
    console.warn("⚠️  Could not open system Chrome profile (" + e.message + ")");
    // Fallback to private profile
    const fallbackDir = path.resolve("pw_lm_profile");
    return await chromium.launchPersistentContext(fallbackDir, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1280, height: 800 }
    });
  }
}

async function waitForUploadInput(ctx, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const p of ctx.pages()) {
      try {
        const el = await p.$(UPLOAD_SEL);
        if (el) return { page: p, upload: el };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for Notebook LM upload box");
}

async function downloadPDF(url) {
  const r = await fetch(url, { timeout: 25_000 });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return {
    name: url.split("/").pop().replace(/\?.*$/, "") || "paper.pdf",
    mimeType: "application/pdf",
    buffer: await r.buffer()
  };
}

app.post("/uploadAndSummarize", async (req, res) => {
  const urls = (req.body.pdfUrls || []).filter(u => u.endsWith(".pdf"));
  if (!urls.length)
    return res.json({ status: "error", error: "No valid PDF URLs" });

  console.log(`📥  UPLOAD ${urls.length} PDFs`);

  const ctx  = await launchCtx();
  const page = (await ctx.pages())[0] || (await ctx.newPage());
  await page.goto("https://notebooklm.google.com", { waitUntil: "load" });

  try {
    const { page: lmPage, upload } = await waitForUploadInput(ctx);
    console.log("✅ Notebook LM ready");

    const files = await Promise.all(urls.map(downloadPDF));
    
    await upload.setInputFiles(files);

    await lmPage.waitForSelector('button[aria-label="Summarize"]', { timeout: 30_000 });
    await lmPage.click('button[aria-label="Summarize"]');

    await lmPage.waitForSelector('[data-testid="source-summary-card"]', { timeout: 60_000 });
    const summaries = await lmPage.$$eval(
      '[data-testid="source-summary-card"]',
      cards => cards.map(c => ({
        title:   c.querySelector("h3")?.innerText ?? "Untitled",
        summary: c.querySelector("div")?.innerText ?? ""
      }))
    );

    res.json({ status: "success", summaries });
  } catch (e) {
    console.error("❌ Playwright error:", e);
    res.json({ status: "error", error: e.message });
  } /* keep Chrome open for future requests */
});

app.listen(PORT, () =>
  console.log(`⇢  http://localhost:${PORT}  (Playwright broker ready)`)
);
