// --- tiny, dependency-free cosine-similarity k-NN ---------------------------
function embed(text) {
    const vec = new Float32Array(300);
    text.toLowerCase().split(/\W+/).forEach(w => {
      if (!w) return;
      const h = [...w].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 300, 7);
      vec[h] += 1;
    });
    return vec;
  }
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }
  // ---------------------------------------------------------------------------
  
  const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";
  const ARXIV_API = "https://export.arxiv.org/api/query";
  
  async function fetchSemanticScholar(query) {
    const url = `${S2_API}?query=${encodeURIComponent(query)}&limit=30&fields=title,abstract,citationCount,url,openAccessPdf`;
    const { data = [] } = await (await fetch(url)).json();
    return data.map(p => ({
      title: p.title,
      abstract: p.abstract || "",
      citations: p.citationCount ?? 0,
      pdfURL: p.openAccessPdf?.url || p.url || ""
    }));
  }
  
  async function fetchArxiv(query) {
    const res = await fetch(`${ARXIV_API}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=30`);
    const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
    return [...xml.getElementsByTagName("entry")].map(e => {
      const idAbs = e.getElementsByTagName("id")[0].textContent;
      const id = idAbs.split("/abs/")[1];
      return {
        title: e.getElementsByTagName("title")[0].textContent.trim(),
        abstract: e.getElementsByTagName("summary")[0].textContent.trim(),
        citations: "N/A",
        pdfURL: `https://arxiv.org/pdf/${id}.pdf`
      };
    });
  }
  
  async function getPapers(query) {
    const [s2, ax] = await Promise.all([
      fetchSemanticScholar(query).catch(_ => []),
      fetchArxiv(query).catch(_ => [])
    ]);
    const candidates = [...s2, ...ax];
    const qVec = embed(query);
    candidates.forEach(p => p.score = cosine(qVec, embed(p.title + " " + p.abstract)));
    return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
  }
  
  function displayPapers(papers) {
    results.innerHTML = papers.map(p => `
      <div class="paper">
        <h3>${p.title}</h3>
        <p><strong>Citations:</strong> ${p.citations}</p>
        <p>${p.abstract.slice(0, 300)}${p.abstract.length > 300 ? "…" : ""}</p>
        <a href="${p.pdfURL}" target="_blank">PDF</a>
      </div>`).join("");
  }
  
  function displaySummaries(summaries) {
    const summaryHTML = summaries.map(s => `
      <div class="summary">
        <h3>${s.title}</h3>
        <p>${s.summary}</p>
      </div>`).join("");
    results.innerHTML += `<hr><h2>Summaries from Notebook LM</h2>${summaryHTML}`;
  }
  
  // UI logic
  const qInput = document.getElementById("query");
  const searchBtn = document.getElementById("searchBtn");
  const results = document.getElementById("results");
  const sumBtn = document.getElementById("summarizeBtn");
  
  searchBtn.onclick = async () => {
    const q = qInput.value.trim();
    if (!q) return alert("Enter a topic first!");
    const papers = await getPapers(q);
    displayPapers(papers);
    window.__pdfs = papers.map(p => p.pdfURL).filter(Boolean);
    sumBtn.style.display = window.__pdfs.length ? "block" : "none";
  };
  
  sumBtn.onclick = () => {
    fetch("http://127.0.0.1:3000/uploadAndSummarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfUrls: window.__pdfs })
    }).then(r => r.json()).then(data => {
      if (data.status === "success") {
        displaySummaries(data.summaries);
      } else {
        alert("Automation error: " + data.error);
      }
    }).catch(e => alert("Server unreachable: " + e));
  };
  