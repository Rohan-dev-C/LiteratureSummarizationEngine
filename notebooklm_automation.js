const { chromium } = require('playwright');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

app.post("/uploadAndSummarize", async (req, res) => {
    const { pdfUrls } = req.body;

    if (!pdfUrls || pdfUrls.length === 0) {
        return res.json({ status: "error", error: "No PDFs provided" });
    }

    (async () => {
        const browser = await chromium.launch({ headless: false }); // Change to true for background execution
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Open Notebook LM
            await page.goto("https://notebooklm.google.com");

            // Wait for the file upload input
            await page.waitForSelector('input[type="file"]', { timeout: 10000 });
            const uploadInput = await page.$('input[type="file"]');

            // Download PDFs and create buffers
            let files = [];
            for (let i = 0; i < pdfUrls.length; i++) {
                let response = await fetch(pdfUrls[i]);
                let buffer = await response.buffer();
                files.push({
                    name: `paper_${i + 1}.pdf`,
                    mimeType: "application/pdf",
                    buffer: buffer
                });
            }

            // Upload files
            await uploadInput.setInputFiles(files);
            console.log("Files uploaded successfully.");

            // Click the summarize button
            await page.waitForSelector('button[aria-label="Summarize"]', { timeout: 10000 });
            await page.click('button[aria-label="Summarize"]');
            console.log("Summarization started!");

            res.json({ status: "success" });

        } catch (error) {
            console.error("Automation error:", error);
            res.json({ status: "error", error: error.message });
        } finally {
            // Close browser after some time to allow users to see the results
            setTimeout(() => browser.close(), 10000);
        }
    })();
});

// Start the Express server for automation
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Playwright server running at http://localhost:${PORT}`);
});
