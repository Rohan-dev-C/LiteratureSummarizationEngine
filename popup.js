console.log("📖 popup.js loaded");

const SEM_API = "https://api.semanticscholar.org/graph/v1/paper/search";
const ARXIV_API = "https://export.arxiv.org/api/query";

// ultralight cosine k-NN
function embed(text) {
  const v = new Float32Array(300);
  text.toLowerCase().split(/\W+/).forEach(w => {
    if (!w) return;
    const h = [...w].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 300, 7);
    v[h] += 1;
  });
  return v;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < 300; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function fetchSemanticScholar(q) {
  const url = `${SEM_API}?query=${encodeURIComponent(q)}&limit=30&fields=title,abstract,citationCount,url,openAccessPdf`;
  const res = await fetch(url);
  const { data = [] } = await res.json();
  return data.map(p => ({
    title: p.title,
    abstract: p.abstract || "",
    citations: p.citationCount || 0,
    pdfURL: p.openAccessPdf?.url || p.url || ""
  }));
}

async function fetchArxiv(q) {
  const res = await fetch(`${ARXIV_API}?search_query=all:${encodeURIComponent(q)}&start=0&max_results=30`);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  return [...xml.getElementsByTagName("entry")].map(e => {
    const id = e.getElementsByTagName("id")[0].textContent.split("/abs/")[1];
    return {
      title: e.getElementsByTagName("title")[0].textContent.trim(),
      abstract: e.getElementsByTagName("summary")[0].textContent.trim(),
      citations: "N/A",
      pdfURL: `https://arxiv.org/pdf/${id}.pdf`
    };
  });
}

async function getPapers(q) {
  const [s2, ax] = await Promise.all([
    fetchSemanticScholar(q).catch(() => []),
    fetchArxiv(q).catch(() => [])
  ]);
  const all = [...s2, ...ax];
  const vq = embed(q);
  all.forEach(p => p.score = cosine(vq, embed(p.title + " " + p.abstract)));
  return all.sort((a, b) => b.score - a.score).slice(0, 10);
}

function displayPapers(papers) {
  const R = document.getElementById("results");
  R.innerHTML = papers.map(p => `
    <div class="paper">
      <h3>${p.title}</h3>
      <p><strong>Citations:</strong> ${p.citations}</p>
      <p>${p.abstract.slice(0, 300)}${p.abstract.length > 300 ? "…" : ""}</p>
      <a href="${p.pdfURL}" target="_blank">PDF</a>
    </div>
  `).join("");
}

function displaySummaries(summaries) {
  const R = document.getElementById("results");
  R.innerHTML += `<hr><h2>Notebook LM Summaries</h2>` +
    summaries.map(s => `
      <div class="summary">
        <h3>${s.title}</h3>
        <p>${s.summary}</p>
      </div>
    `).join("");
}

// ✅ DOMContentLoaded ensures button hooks attach reliably
document.addEventListener("DOMContentLoaded", () => {
  const queryInput = document.getElementById("query");
  const searchBtn = document.getElementById("searchBtn");
  const summarizeBtn = document.getElementById("summarizeBtn");

  summarizeBtn.disabled = true;

  searchBtn.addEventListener("click", async () => {
    const q = queryInput.value.trim();
    if (!q) return alert("Enter a topic.");
    console.log("🔍 Searching:", q);
    const papers = await getPapers(q);
    displayPapers(papers);
    window.__pdfs = papers.map(p => p.pdfURL).filter(Boolean);
    summarizeBtn.style.display = window.__pdfs.length ? "block" : "none";
    summarizeBtn.disabled = !window.__pdfs.length;
  });

  summarizeBtn.addEventListener("click", async () => {
    console.log("🖇️ Summarize clicked:", window.__pdfs);
    summarizeBtn.disabled = true;
    summarizeBtn.textContent = "Summarizing…";
    try {
      const res = await fetch("http://localhost:3000/uploadAndSummarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrls: window.__pdfs })
      }).catch(() =>
        fetch("http://127.0.0.1:3000/uploadAndSummarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfUrls: window.__pdfs })
        })
      );
      const data = await res.json();
      if (data.status === "success") {
        console.log("✅ Got summaries:", data.summaries);
        displaySummaries(data.summaries);
      } else {
        throw new Error(data.error || "unknown automation error");
      }
    } catch (e) {
      console.error("❌ Fetch failed:", e);
      alert("Could not reach local broker:\n" + e.message +
        "\n\nIs `npm start` running in notebooklm-broker?");
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = "Summarize in Notebook LM";
    }
  });
});
