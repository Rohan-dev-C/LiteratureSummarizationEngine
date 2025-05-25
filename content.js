chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'upload_pdfs' && message.pdfs) {
      console.log("Uploading PDFs to Notebook LM:", message.pdfs);
      
      // Simulate clicking the "Upload" button
      let uploadButton = document.querySelector('input[type="file"]');
      if (!uploadButton) {
          console.error("Upload button not found!");
          sendResponse({ status: "Upload button not found" });
          return;
      }

      // Convert URLs to File objects (this part might require backend support)
      let filesToUpload = [];
      message.pdfs.forEach(url => {
          fetch(url)
              .then(response => response.blob())
              .then(blob => {
                  let file = new File([blob], url.split('/').pop(), { type: 'application/pdf' });
                  filesToUpload.push(file);
                  
                  if (filesToUpload.length === message.pdfs.length) {
                      // All PDFs are fetched; now trigger the upload
                      let dataTransfer = new DataTransfer();
                      filesToUpload.forEach(file => dataTransfer.items.add(file));
                      uploadButton.files = dataTransfer.files;
                      uploadButton.dispatchEvent(new Event('change', { bubbles: true }));
                      
                      console.log("Files uploaded successfully!");
                      sendResponse({ status: "Files uploaded" });

                      // Simulate clicking the "Summarize" button (adjust selector if needed)
                      setTimeout(() => {
                          let summarizeButton = document.querySelector('button[aria-label="Summarize"]');
                          if (summarizeButton) {
                              summarizeButton.click();
                              console.log("Summarization triggered!");
                              sendResponse({ status: "Summarization started" });
                          } else {
                              console.error("Summarize button not found!");
                              sendResponse({ status: "Summarize button not found" });
                          }
                      }, 3000); // Delay to allow upload processing
                  }
              })
              .catch(error => {
                  console.error("Error fetching PDF:", error);
                  sendResponse({ status: "Error fetching PDF" });
              });
      });
  }
});
