/**
 * PDF to Tags: extract text from uploaded PDF and feed into the existing editor + parse flow.
 * Requires: PDF.js (pdfjsLib), editor #editor, parseBtn #parseBtn.
 */
(function () {
  var fileInput = document.getElementById("pdfFileInput");
  var editor = document.getElementById("editor");
  var parseBtn = document.getElementById("parseBtn");
  var pdfStatus = document.getElementById("pdfStatus");
  var pdfExtractArea = document.getElementById("pdfExtractArea");

  if (!fileInput || !editor || !parseBtn) return;

  fileInput.addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      if (pdfStatus) {
        pdfStatus.textContent = "Please choose a PDF file.";
        pdfStatus.className = "pdf-status pdf-status-error";
      }
      return;
    }

    if (pdfStatus) {
      pdfStatus.textContent = "Extracting text…";
      pdfStatus.className = "pdf-status";
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var arrayBuffer = ev.target.result;
      if (typeof pdfjsLib === "undefined") {
        if (pdfStatus) {
          pdfStatus.textContent = "PDF library not loaded. Refresh the page.";
          pdfStatus.className = "pdf-status pdf-status-error";
        }
        return;
      }

      pdfjsLib.getDocument(arrayBuffer).promise
        .then(function (pdfDoc) {
          var numPages = pdfDoc.numPages;
          var allText = [];

          function getPageText(pageNum) {
            return pdfDoc.getPage(pageNum).then(function (page) {
              return page.getTextContent().then(function (content) {
                var items = content.items || [];
                var lines = [];
                var lastY = null;
                for (var i = 0; i < items.length; i++) {
                  var item = items[i];
                  var str = item.str || "";
                  if (str) lines.push(str);
                }
                return lines.join(" ");
              });
            });
          }

          var chain = Promise.resolve();
          for (var p = 1; p <= numPages; p++) {
            (function (pageNum) {
              chain = chain.then(function () {
                return getPageText(pageNum).then(function (text) {
                  allText.push(text);
                });
              });
            })(p);
          }

          return chain.then(function () {
            var fullText = allText.join("\n\n");
            var hasText = fullText.trim().length > 0;
            if (!hasText) {
              editor.innerHTML = "<p>No text could be extracted from this PDF. It may be image-only (e.g. a scanned invoice or photo). Use a PDF with selectable text, or copy text from the PDF and use <a href=\"/text-to-tags.html\">Text to Tags</a> instead.</p>";
              editor.dispatchEvent(new Event("input", { bubbles: true }));
              if (pdfExtractArea) pdfExtractArea.classList.add("is-loaded");
              if (pdfStatus) {
                pdfStatus.textContent = "No text could be extracted. This PDF may be image-only (scanned). Try a PDF with selectable text or use Text to Tags.";
                pdfStatus.className = "pdf-status pdf-status-error";
              }
              return;
            }
            var paras = fullText.split(/\n\n+/).filter(function (p) { return p.trim().length > 0; });
            var html = paras.length ? paras.map(function (p) {
              return "<p>" + escapeHtml(p.trim()) + "</p>";
            }).join("") : "<p>" + escapeHtml(fullText.trim()) + "</p>";
            editor.innerHTML = html;
            editor.dispatchEvent(new Event("input", { bubbles: true }));
            if (pdfExtractArea) pdfExtractArea.classList.add("is-loaded");
            if (pdfStatus) {
              pdfStatus.textContent = "Text extracted. Click Parse formatting, then assign meanings and Generate.";
              pdfStatus.className = "pdf-status pdf-status-success";
            }
            if (parseBtn) parseBtn.click();
          });
        })
        .catch(function (err) {
          if (pdfStatus) {
            pdfStatus.textContent = "Could not read PDF. Try a different file or check that it’s not password-protected.";
            pdfStatus.className = "pdf-status pdf-status-error";
          }
          console.warn("PDF extract error:", err);
        });
    };
    reader.readAsArrayBuffer(file);
  });

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
})();
