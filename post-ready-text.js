(function () {
  var inputEl = document.getElementById("postReadyInput");
  var outputEl = document.getElementById("postReadyOutput");
  var generateBtn = document.getElementById("postReadyGenerateBtn");
  var copyBtn = document.getElementById("postReadyCopyBtn");
  var copyStatus = document.getElementById("postReadyCopyStatus");

  var TAB_WIDTH = 4;
  var NBSP = "\u00a0";

  function rgbColorStringIsLight(cssColor) {
    if (!cssColor || typeof cssColor !== "string") return false;
    var m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return false;
    var r = parseInt(m[1], 10);
    var g = parseInt(m[2], 10);
    var b = parseInt(m[3], 10);
    return r > 210 && g > 210 && b > 210;
  }

  function isLightForegroundCss(val) {
    if (!val || typeof val !== "string") return false;
    var v = val.toLowerCase().trim();
    if (v === "#fff" || v === "#ffffff" || v === "white") return true;
    return rgbColorStringIsLight(v);
  }

  /** Grok dark-theme copies often include white/light text colors — reset so content is visible on our light canvas. */
  function normalizePastedLightForeground(root) {
    if (!root || !root.querySelectorAll) return;
    var styled = root.querySelectorAll("[style]");
    for (var i = 0; i < styled.length; i++) {
      var el = styled[i];
      var st = el.getAttribute("style");
      if (!st) continue;
      var next = st.replace(/color\s*:\s*[^;]+;?/gi, function (block) {
        var val = block
          .replace(/^color\s*:\s*/i, "")
          .replace(/;+\s*$/g, "")
          .trim();
        return isLightForegroundCss(val) ? "" : block;
      });
      next = next.replace(/;\s*;/g, ";").replace(/^[\s;]+|[\s;]+$/g, "").trim();
      if (next) el.setAttribute("style", next);
      else el.removeAttribute("style");
    }

    if (!window.getComputedStyle) return;
    var all = root.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var node = all[j];
      try {
        var c = window.getComputedStyle(node).color;
        if (rgbColorStringIsLight(c)) node.style.color = "inherit";
      } catch (e) {}
    }
  }

  function unicodeBoldChar(ch) {
    var code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + (code - 97));
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + (code - 48));
    return ch;
  }

  function unicodeBoldString(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        out += str[i] + str[++i];
        continue;
      }
      out += unicodeBoldChar(str[i]);
    }
    return out;
  }

  function isBoldElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    var tag = el.tagName.toUpperCase();
    if (tag === "STRONG" || tag === "B") return true;
    var st = el.getAttribute("style");
    if (st && /font-weight\s*:\s*(700|bold|[6-9]\d{2})/i.test(st)) return true;
    return false;
  }

  function serializeInline(node, bold) {
    bold = !!bold;
    var out = "";
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        var t = child.textContent || "";
        out += bold ? unicodeBoldString(t) : t;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        var tag = child.tagName.toUpperCase();
        var nextBold = bold || isBoldElement(child);
        if (tag === "BR") out += "\n";
        else if (tag === "UL" || tag === "OL")
          out += "\n" + serializeListBlock(child) + "\n";
        else out += serializeInline(child, nextBold);
      }
    }
    return out;
  }

  function serializeListBlock(ulol) {
    var buf = "";
    for (var i = 0; i < ulol.children.length; i++) {
      var li = ulol.children[i];
      if (li.tagName.toUpperCase() !== "LI") continue;
      buf += serializeLiBlock(li);
    }
    return buf;
  }

  function serializeLiBlock(li) {
    var line = "";
    for (var i = 0; i < li.childNodes.length; i++) {
      var c = li.childNodes[i];
      if (c.nodeType === Node.TEXT_NODE) {
        line += c.textContent || "";
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        var t = c.tagName.toUpperCase();
        if (t === "UL" || t === "OL") line += "\n" + serializeListBlock(c);
        else line += serializeInline(c, false);
      }
    }
    line = line.trim().replace(/\n\s*\n/g, "\n");
    return "• " + line + "\n";
  }

  function serializeBlockNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      var tx = (node.textContent || "").trim();
      return tx ? tx + "\n\n" : "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    var tag = node.tagName.toUpperCase();
    if (tag === "BR") return "\n";
    if (tag === "UL" || tag === "OL") return serializeListBlock(node) + "\n";
    if (
      tag === "DIV" ||
      tag === "P" ||
      tag === "SECTION" ||
      tag === "ARTICLE" ||
      tag === "MAIN"
    ) {
      return serializeInline(node, false).trim() + "\n\n";
    }
    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
      return serializeInline(node, false).trim() + "\n\n";
    }
    return serializeInline(node, false).trim() + "\n\n";
  }

  function editorToRawPlain(editorEl) {
    var parts = [];
    for (var i = 0; i < editorEl.childNodes.length; i++) {
      parts.push(serializeBlockNode(editorEl.childNodes[i]));
    }
    return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  function makePostReadyText(raw) {
    var normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = normalized.split("\n");
    return lines
      .map(function (line) {
        var m = /^([\t ]*)/.exec(line);
        var indent = m ? m[1] : "";
        var rest = line.slice(indent.length);
        var expanded = "";
        for (var i = 0; i < indent.length; i++) {
          if (indent.charAt(i) === "\t") {
            for (var t = 0; t < TAB_WIDTH; t++) expanded += NBSP;
          } else {
            expanded += NBSP;
          }
        }
        return expanded + rest;
      })
      .join("\n");
  }

  function editorHasContent() {
    if (!inputEl) return false;
    var text = (inputEl.textContent || "").replace(/\u200b/g, "").trim();
    return text.length > 0;
  }

  function syncButtons() {
    if (generateBtn) generateBtn.disabled = !editorHasContent();
    if (copyBtn)
      copyBtn.disabled = !(outputEl && (outputEl.value || "").length > 0);
  }

  function sanitizeClipboardHtml(html) {
    return html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object\b[\s\S]*?<\/object>/gi, "")
      .replace(/<embed\b[^>]*>/gi, "");
  }

  if (inputEl) {
    inputEl.addEventListener("input", syncButtons);

    inputEl.addEventListener("paste", function (e) {
      var cd = e.clipboardData;
      var html = cd && cd.getData("text/html");
      if (html) {
        e.preventDefault();
        html = sanitizeClipboardHtml(html);
        if (html && typeof clonePasteIntoEditor === "function") {
          try {
            clonePasteIntoEditor(html, inputEl);
          } catch (err) {
            try {
              document.execCommand("insertHTML", false, html);
            } catch (err2) {
              inputEl.focus();
              document.execCommand("insertHTML", false, html);
            }
          }
          normalizePastedLightForeground(inputEl);
        } else {
          var fallback = (cd && cd.getData("text/plain")) || "";
          document.execCommand("insertText", false, fallback);
        }
      } else {
        var plain = cd && cd.getData("text/plain");
        if (plain) {
          e.preventDefault();
          document.execCommand("insertText", false, plain);
        }
      }
      syncButtons();
    });
  }

  if (generateBtn && inputEl && outputEl) {
    generateBtn.addEventListener("click", function () {
      var raw = editorToRawPlain(inputEl);
      outputEl.value = makePostReadyText(raw);
      syncButtons();
    });
  }

  if (copyBtn && outputEl) {
    copyBtn.addEventListener("click", function () {
      var plainText = outputEl.value || "";
      if (!plainText) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(
          function () {
            if (copyStatus) copyStatus.textContent = "Copied.";
            window.setTimeout(function () {
              if (copyStatus) copyStatus.textContent = "";
            }, 2000);
          },
          function () {
            if (copyStatus)
              copyStatus.textContent =
                "Unable to copy. Select the text manually.";
          }
        );
      } else {
        outputEl.focus();
        outputEl.select();
        try {
          var ok = document.execCommand("copy");
          if (copyStatus)
            copyStatus.textContent = ok
              ? "Copied."
              : "Select the text and copy manually.";
        } catch (e) {
          if (copyStatus)
            copyStatus.textContent = "Select the text and copy manually.";
        }
        window.setTimeout(function () {
          if (copyStatus && copyStatus.textContent === "Copied.")
            copyStatus.textContent = "";
        }, 2000);
      }
    });
  }

  syncButtons();
})();
