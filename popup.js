const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search";
const ARXIV_API = "http://export.arxiv.org/api/query";

// Function to fetch top 10 research papers from Semantic Scholar
async function fetchResearchPapers(query) {
    try {
        // Fetch papers from Semantic Scholar
        const response = await fetch(`${SEMANTIC_SCHOLAR_API}?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,citationCount,url`);
        const data = await response.json();

        // Check if data is valid
        if (!data.data || data.data.length === 0) {
            console.warn("No results from Semantic Scholar. Trying arXiv...");
            return fetchArxivPapers(query);  // Fallback to arXiv
        }

        // Process and return top 10 papers
        return data.data.map(paper => ({
            title: paper.title,
            abstract: paper.abstract || "No abstract available.",
            citations: paper.citationCount || 0,
            pdfURL: paper.url || "#"
        }));
    } catch (error) {
        console.error("Error fetching Semantic Scholar papers:", error);
        return fetchArxivPapers(query);  // Try arXiv as a backup
    }
}

// Function to fetch top 10 research papers from arXiv
async function fetchArxivPapers(query) {
    try {
        const response = await fetch(`${ARXIV_API}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=10&sortBy=relevance`);
        const text = await response.text();
        
        // Parse XML response from arXiv
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const entries = xml.getElementsByTagName("entry");
        
        // Extract relevant information
        let papers = [];
        for (let entry of entries) {
            let title = entry.getElementsByTagName("title")[0].textContent;
            let summary = entry.getElementsByTagName("summary")[0].textContent;
            let pdfURL = entry.getElementsByTagName("id")[0].textContent;
            
            papers.push({
                title: title.trim(),
                abstract: summary.trim(),
                citations: "N/A",  // arXiv does not provide citation counts
                pdfURL: pdfURL
            });
        }
        return papers;
    } catch (error) {
        console.error("Error fetching arXiv papers:", error);
        return [];
    }
}

// Listen for utton click
document.getElementById('searchBtn').addEventListener('click', async function () {
    const query = document.getElementById('query').value.trim();
    if (!query) {
        alert("Please enter a topic.");
        return;
    }

    // Fetch real research papers
    let topPapers = await fetchResearchPapers(query);

    // Display results in popup
    displayResults(topPapers);

    // Store for later use
    window.topPapers = topPapers;
    document.getElementById('summarizeBtn').style.display = 'block';
});

// Function to display papers in the popup UI
function displayResults(papers) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    papers.forEach(paper => {
        const paperDiv = document.createElement('div');
        paperDiv.className = 'paper';
        paperDiv.innerHTML = `
            <h3>${paper.title}</h3>
            <p><strong>Citations:</strong> ${paper.citations}</p>
            <p>${paper.abstract}</p>
            <a href="${paper.pdfURL}" target="_blank">Read Paper</a>
        `;
        resultsDiv.appendChild(paperDiv);
    });
}

// Listen for summarize button click
document.getElementById("summarizeBtn").addEventListener("click", async function () {
  if (window.topPapers) {
      const pdfUrls = window.topPapers.map(paper => paper.pdfURL);

      // Send a request to the local Playwright automation server
      fetch("http://localhost:3000/uploadAndSummarize", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ pdfUrls })
      })
      .then(response => response.json())
      .then(data => {
          if (data.status === "success") {
              alert("Files uploaded and summarization started in Notebook LM!");
          } else {
              alert("Error during automation: " + data.error);
          }
      })
      .catch(error => console.error("Error calling automation server:", error));
  }
});

