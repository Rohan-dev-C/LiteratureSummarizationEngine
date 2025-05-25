chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "uploadAndSummarize") {
        fetch("http://localhost:3000/uploadAndSummarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfUrls: message.pdfUrls })
        })
        .then(response => response.json())
        .then(data => sendResponse(data))
        .catch(error => sendResponse({ status: "error", error: error.message }));

        return true; // Keeps the message channel open for async response
    }
});
