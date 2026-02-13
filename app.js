// Core DOM elements
var editor = document.getElementById("editor");
var parseBtn = document.getElementById("parseBtn");
var detectedFormattingContainer = document.getElementById(
  "detectedFormattingContainer"
);
var generateBtn = document.getElementById("generateBtn");
var copyBtn = document.getElementById("copyBtn");
var outputEditor = document.getElementById("outputEditor");
var outputPreview = document.getElementById("outputPreview");
var copyStatus = document.getElementById("copyStatus");
var lightThemeBtn = document.getElementById("lightThemeBtn");
var darkThemeBtn = document.getElementById("darkThemeBtn");
var feedbackLikeBtn = document.getElementById("feedbackLikeBtn");
var feedbackDislikeBtn = document.getElementById("feedbackDislikeBtn");
var feedbackQuestionBtn = document.getElementById("feedbackQuestionBtn");
var feedbackModal = document.getElementById("feedbackModal");
var feedbackForm = document.getElementById("feedbackForm");
var feedbackEmailInput = document.getElementById("feedbackEmailInput");
var feedbackTypeField = document.getElementById("feedbackTypeField");
var feedbackCancelBtn = document.getElementById("feedbackCancelBtn");
var feedbackStatus = document.getElementById("feedbackStatus");

// State for detected formats and user-defined meanings
// Each entry: { id, kind, key, displayName, previewStyle, userLabel }
var detectedFormats = [];
var editorDefaultColor = null;
var editorDefaultTextAlign = null;
var editorDefaultWeight = null;

function ensureEditorDefaults() {
  // Determine default color and text alignment for the editor in the current theme
  if (!editorDefaultColor || !editorDefaultTextAlign || !editorDefaultWeight) {
    var tmp = document.createElement("span");
    tmp.textContent = "a";
    editor.appendChild(tmp);
    var cs = window.getComputedStyle(tmp);
    editorDefaultColor = cs.color;
    editorDefaultTextAlign = cs.textAlign;
    var w = cs.fontWeight;
    var wNum = parseInt(w, 10);
    editorDefaultWeight = isNaN(wNum) ? w : wNum;
    editor.removeChild(tmp);
  }
}

// Utility: check whether the editor has any real content (beyond whitespace and empty blocks)
function editorHasContent() {
  if (!editor) return false;
  var text = editor.textContent || "";
  if (text.replace(/\u200b/g, "").trim().length > 0) {
    return true;
  }
  // Also treat any non-empty element nodes as content
  for (var i = 0; i < editor.childNodes.length; i++) {
    var node = editor.childNodes[i];
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node.textContent || "").trim().length > 0) {
        return true;
      }
    }
  }
  return false;
}

function updateButtonsEnabledState() {
  var hasContent = editorHasContent();
  parseBtn.disabled = !hasContent;
  // Generate is enabled when there is content and at least one user-defined label
  var hasLabel = detectedFormats.some(function (f) {
    return f.userLabel && f.userLabel.trim().length > 0;
  });
  generateBtn.disabled = !(hasContent && hasLabel);
}

// Theme toggle logic (background toggle)
function setTheme(theme) {
  var isLight = theme === "light";
  var body = document.body;
  if (isLight) {
    body.classList.remove("theme-dark");
    body.classList.add("theme-light");
  } else {
    body.classList.remove("theme-light");
    body.classList.add("theme-dark");
  }

  // Update toggle buttons
  if (isLight) {
    lightThemeBtn.classList.add("is-active");
    darkThemeBtn.classList.remove("is-active");
    lightThemeBtn.disabled = true;
    darkThemeBtn.disabled = false;
    lightThemeBtn.setAttribute("aria-pressed", "true");
    darkThemeBtn.setAttribute("aria-pressed", "false");
  } else {
    darkThemeBtn.classList.add("is-active");
    lightThemeBtn.classList.remove("is-active");
    darkThemeBtn.disabled = true;
    lightThemeBtn.disabled = false;
    darkThemeBtn.setAttribute("aria-pressed", "true");
    lightThemeBtn.setAttribute("aria-pressed", "false");
  }

  // Reset cached defaults so they are recalculated under the new theme
  editorDefaultColor = null;
  editorDefaultTextAlign = null;
}

// Formatting detection
function detectFormatting() {
  ensureEditorDefaults();

  var found = {
    bold: false,
    italic: false,
    underline: false,
    headings: {}, // level -> true
    colors: {}, // colorString -> true
    alignments: {} // alignString -> true
  };

  var walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  // Include editor itself for alignment detection
  var rootElements = [editor];
  while (walker.nextNode()) {
    rootElements.push(walker.currentNode);
  }

  for (var i = 0; i < rootElements.length; i++) {
    var el = rootElements[i];
    if (el === editor) {
      // only alignment on editor is meaningful if user changed it
      var editorStyle = window.getComputedStyle(editor);
      var align = editorStyle.textAlign;
      if (align && align !== editorDefaultTextAlign) {
        found.alignments[align] = true;
      }
      continue;
    }

    var tag = el.tagName;
    var style = window.getComputedStyle(el);

    // Bold
    if (tag === "B" || tag === "STRONG") {
      found.bold = true;
    } else {
      var weightStr = style.fontWeight;
      var weightNum = parseInt(weightStr, 10);
      var defaultNum =
        typeof editorDefaultWeight === "number"
          ? editorDefaultWeight
          : parseInt(editorDefaultWeight, 10);
      if (
        !isNaN(weightNum) &&
        weightNum >= 600 &&
        (!defaultNum || weightNum > defaultNum)
      ) {
        found.bold = true;
      }
    }

    // Italic
    if (tag === "I" || tag === "EM" || style.fontStyle === "italic" || style.fontStyle === "oblique") {
      found.italic = true;
    }

    // Underline
    var textDecoration = style.textDecorationLine || style.textDecoration;
    if (textDecoration && textDecoration.indexOf("underline") !== -1) {
      found.underline = true;
    }

    // Headings
    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6") {
      found.headings[tag] = true;
    }

    // Colors
    var color = style.color;
    if (color && color !== editorDefaultColor && color !== "rgb(0, 0, 0)") {
      found.colors[color] = true;
    }

    // Alignment on block-level elements
    var alignValue = style.textAlign;
    if (alignValue && alignValue !== editorDefaultTextAlign) {
      found.alignments[alignValue] = true;
    }
  }

  buildDetectedFormattingUI(found);
}

// Build Detected Formatting UI
function buildDetectedFormattingUI(found) {
  detectedFormats = [];
  while (detectedFormattingContainer.firstChild) {
    detectedFormattingContainer.removeChild(
      detectedFormattingContainer.firstChild
    );
  }
  detectedFormattingContainer.classList.remove("empty-state");

  var anyDetected = false;

  function addFormat(kind, key, label, previewCreator) {
    anyDetected = true;
    var id = kind + ":" + key;

    var item = document.createElement("div");
    item.className = "detected-item";
    item.setAttribute("data-format-id", id);

    var labelEl = document.createElement("div");
    labelEl.className = "detected-label";
    labelEl.textContent = label;

    var preview = document.createElement("div");
    preview.className = "detected-preview";
    previewCreator(preview);

    var previewWrapper = document.createElement("div");
    previewWrapper.appendChild(preview);

    var inputWrapper = document.createElement("div");
    inputWrapper.className = "detected-input-wrapper";

    var input = document.createElement("input");
    input.type = "text";
    input.className = "detected-input";
    input.placeholder = "Tag name (e.g. Question)";
    input.setAttribute(
      "aria-label",
      "Semantic meaning for " + label
    );

    inputWrapper.appendChild(input);

    item.appendChild(labelEl);
    item.appendChild(previewWrapper);
    item.appendChild(inputWrapper);

    detectedFormattingContainer.appendChild(item);

    var formatEntry = {
      id: id,
      kind: kind,
      key: key,
      displayName: label,
      userLabel: ""
    };
    detectedFormats.push(formatEntry);

    input.addEventListener("input", function () {
      formatEntry.userLabel = input.value;
      updateButtonsEnabledState();
    });
  }

  // Bold
  if (found.bold) {
    addFormat("bold", "bold", "Bold", function (preview) {
      var span = document.createElement("span");
      span.style.fontWeight = "700";
      span.textContent = "Bold text";
      preview.appendChild(span);
    });
  }

  // Italic
  if (found.italic) {
    addFormat("italic", "italic", "Italic", function (preview) {
      var span = document.createElement("span");
      span.style.fontStyle = "italic";
      span.textContent = "Italic text";
      preview.appendChild(span);
    });
  }

  // Underline
  if (found.underline) {
    addFormat("underline", "underline", "Underline", function (preview) {
      var span = document.createElement("span");
      span.style.textDecoration = "underline";
      span.textContent = "Underlined text";
      preview.appendChild(span);
    });
  }

  // Headings
  var levels = ["H1", "H2", "H3", "H4", "H5", "H6"];
  for (var i = 0; i < levels.length; i++) {
    var level = levels[i];
    if (found.headings[level]) {
      (function (lvl) {
        addFormat(
          "heading",
          lvl,
          lvl + " heading",
          function (preview) {
            var span = document.createElement("span");
            span.style.fontWeight = "600";
            span.style.fontSize = "0.95rem";
            span.textContent = lvl + " preview";
            preview.appendChild(span);
          }
        );
      })(level);
    }
  }

  // Colors
  for (var color in found.colors) {
    if (Object.prototype.hasOwnProperty.call(found.colors, color)) {
      (function (c) {
        addFormat("color", c, "Color", function (preview) {
          var swatch = document.createElement("span");
          swatch.className = "color-swatch";
          swatch.style.backgroundColor = c;

          preview.appendChild(swatch);
        });
      })(color);
    }
  }

  // Alignments
  for (var align in found.alignments) {
    if (Object.prototype.hasOwnProperty.call(found.alignments, align)) {
      (function (a) {
        addFormat("alignment", a, "Alignment: " + a, function (preview) {
          var span = document.createElement("span");
          span.style.textAlign = a;
          span.style.display = "inline-block";
          span.style.minWidth = "60px";
          span.textContent = "Aligned";
          preview.appendChild(span);
        });
      })(align);
    }
  }

  if (!anyDetected) {
    detectedFormattingContainer.classList.add("empty-state");
    var msg = document.createElement("p");
    msg.className = "empty-message";
    msg.textContent =
      "No special formatting detected. Try adding bold, color, headings, or alignment.";
    detectedFormattingContainer.appendChild(msg);
  }

  updateButtonsEnabledState();
}

// Conversion logic
function generateTaggedOutput() {
  ensureEditorDefaults();

  if (!editorHasContent()) {
    outputEditor.textContent = "";
    copyBtn.disabled = true;
    return;
  }

  var activeFormats = detectedFormats.filter(function (f) {
    return f.userLabel && f.userLabel.trim().length > 0;
  });

  if (activeFormats.length === 0) {
    // No semantic tags defined, output original text as-is
    var original = editor.textContent || "";
    outputEditor.textContent = original;
    if (outputPreview) {
      renderPreviewFromText(original);
    }
    copyBtn.disabled = !editorHasContent();
    return;
  }

  // Build a single string that mirrors the original text content, with tags injected.
  var outputText = buildSegmentedText(activeFormats);
  outputEditor.textContent = outputText;
  if (outputPreview) {
    renderPreviewFromText(outputText);
  }
  copyBtn.disabled = outputText.trim().length === 0;
}

// Collect top-level "lines" from editor (top-level block elements or text blocks)
function collectLinesWithNodes() {
  var lines = [];

  for (var i = 0; i < editor.childNodes.length; i++) {
    var node = editor.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      var txt = (node.nodeValue || "").trim();
      if (txt.length > 0) {
        lines.push({ node: node, text: node.nodeValue.replace(/\s+/g, " ").trim() });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Treat each element as a block/line
      var lineText = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (lineText.length > 0) {
        lines.push({ node: node, text: lineText });
      }
    }
  }

  return lines;
}

function collectPlainLines() {
  var nodes = collectLinesWithNodes();
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    out.push(nodes[i].text);
  }
  return out;
}

// Build output preserving original text (including spaces/newlines),
// injecting tags around formatted segments with proper nesting.
function buildSegmentedText(activeFormats) {
  var nodes = [];
  var labelsPerIndex = [];

  // Collect text nodes and <br> markers in document order
  var walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );
  var current;
  while ((current = walker.nextNode())) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === "BR") {
        nodes.push({ type: "br" });
        labelsPerIndex.push([]);
      }
    } else if (current.nodeType === Node.TEXT_NODE) {
      var text = current.nodeValue || "";
      if (text.length === 0) continue;
      nodes.push({ type: "text", node: current, text: text });
      labelsPerIndex.push(allFormatsForTextNode(current, activeFormats));
    }
  }

  // Compute span length (first/last index) for each label so we can order outer vs inner tags
  var spanStart = {};
  var spanEnd = {};
  for (var i = 0; i < labelsPerIndex.length; i++) {
    var labels = labelsPerIndex[i];
    for (var li = 0; li < labels.length; li++) {
      var lbl = labels[li];
      if (spanStart[lbl] === undefined) {
        spanStart[lbl] = i;
      }
      spanEnd[lbl] = i;
    }
  }

  // Determine opening priority: tags that span more of the document open first (become outer tags)
  var openingOrder = activeFormats
    .map(function (f) {
      return f.userLabel;
    })
    .filter(function (lbl) {
      return lbl;
    })
    .sort(function (a, b) {
      var lenA =
        spanStart[a] === undefined || spanEnd[a] === undefined
          ? -1
          : spanEnd[a] - spanStart[a];
      var lenB =
        spanStart[b] === undefined || spanEnd[b] === undefined
          ? -1
          : spanEnd[b] - spanStart[b];
      return lenB - lenA;
    });

  var result = "";
  var openTags = [];

  for (var idx = 0; idx < nodes.length; idx++) {
    var item = nodes[idx];
    if (item.type === "br") {
      result += "\n";
      continue;
    }

    var textNodeLabels = labelsPerIndex[idx];

    // Close tags that are no longer active (inner to outer)
    for (var ci = openTags.length - 1; ci >= 0; ci--) {
      if (textNodeLabels.indexOf(openTags[ci]) === -1) {
        result += "</" + openTags[ci] + ">";
        openTags.splice(ci, 1);
      }
    }

    // Open new tags in openingOrder (outer to inner)
    for (var oi = 0; oi < openingOrder.length; oi++) {
      var tag = openingOrder[oi];
      if (
        textNodeLabels.indexOf(tag) !== -1 &&
        openTags.indexOf(tag) === -1
      ) {
        result += "<" + tag + ">";
        openTags.push(tag);
      }
    }

    // Append the actual text exactly as in input
    result += item.text;
  }

  // Close any remaining open tags at the end (inner to outer)
  for (var cj = openTags.length - 1; cj >= 0; cj--) {
    result += "</" + openTags[cj] + ">";
  }

  return result;
}

function allFormatsForTextNode(textNode, activeFormats) {
  var labels = [];
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return labels;
  }

  var el = textNode.parentElement;
  if (!el) return labels;

  var defaultColor = editorDefaultColor;
  var defaultAlign = editorDefaultTextAlign;
  var style = window.getComputedStyle(el);

  for (var i = 0; i < activeFormats.length; i++) {
    var fmt = activeFormats[i];
    var label = fmt.userLabel;
    if (!label || labels.indexOf(label) !== -1) continue;

    if (fmt.kind === "bold") {
      var isBold = false;
      var weightStr = style.fontWeight;
      var weightNum = parseInt(weightStr, 10);
      var defaultNum =
        typeof editorDefaultWeight === "number"
          ? editorDefaultWeight
          : parseInt(editorDefaultWeight, 10);
      if (!isNaN(weightNum) && weightNum >= 600 && (!defaultNum || weightNum > defaultNum)) {
        isBold = true;
      } else {
        // Fallback: look for <b>/<strong> ancestors
        var n = el;
        while (n && n !== editor.parentNode) {
          var tag = n.tagName;
          if (tag === "B" || tag === "STRONG") {
            isBold = true;
            break;
          }
          n = n.parentElement;
        }
      }
      if (isBold) {
        labels.push(label);
      }
    } else if (fmt.kind === "italic") {
      if (style.fontStyle === "italic" || style.fontStyle === "oblique") {
        labels.push(label);
      } else {
        var nIt = el;
        while (nIt && nIt !== editor.parentNode) {
          var tIt = nIt.tagName;
          if (tIt === "I" || tIt === "EM") {
            labels.push(label);
            break;
          }
          nIt = nIt.parentElement;
        }
      }
    } else if (fmt.kind === "underline") {
      var textDecoration = style.textDecorationLine || style.textDecoration;
      if (textDecoration && textDecoration.indexOf("underline") !== -1) {
        labels.push(label);
      }
    } else if (fmt.kind === "heading") {
      var nH = el;
      while (nH && nH !== editor.parentNode) {
        if (nH.tagName === fmt.key) {
          labels.push(label);
          break;
        }
        nH = nH.parentElement;
      }
    } else if (fmt.kind === "color") {
      var color = style.color;
      if (
        color &&
        color !== defaultColor &&
        color !== "rgb(0, 0, 0)" &&
        color === fmt.key
      ) {
        labels.push(label);
      }
    } else if (fmt.kind === "alignment") {
      var align = style.textAlign;
      if (align && align !== defaultAlign && align === fmt.key) {
        labels.push(label);
      }
    }
  }

  return labels;
}

// Determine if a line node contains a specific format
function lineHasFormat(lineNode, fmt) {
  var walker = document.createTreeWalker(
    lineNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null
  );

  var defaultColor = editorDefaultColor;
  var defaultAlign = editorDefaultTextAlign;

  var current = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      var el = current;
      var tag = el.tagName;
      var style = window.getComputedStyle(el);

      if (fmt.kind === "bold") {
        if (tag === "B" || tag === "STRONG") {
          return true;
        }
        var weight = parseInt(style.fontWeight, 10);
        if (!isNaN(weight) && weight >= 600) {
          return true;
        }
      } else if (fmt.kind === "italic") {
        if (tag === "I" || tag === "EM") {
          return true;
        }
        if (style.fontStyle === "italic" || style.fontStyle === "oblique") {
          return true;
        }
      } else if (fmt.kind === "underline") {
        var textDecoration = style.textDecorationLine || style.textDecoration;
        if (textDecoration && textDecoration.indexOf("underline") !== -1) {
          return true;
        }
      } else if (fmt.kind === "heading") {
        if (tag === fmt.key) {
          return true;
        }
      } else if (fmt.kind === "color") {
        var color = style.color;
        if (color && color !== defaultColor && color !== "rgb(0, 0, 0)" && color === fmt.key) {
          return true;
        }
      } else if (fmt.kind === "alignment") {
        var align = style.textAlign;
        if (align && align !== defaultAlign && align === fmt.key) {
          return true;
        }
      }
    }

    if (!walker.nextNode()) {
      break;
    }
    current = walker.currentNode;
  }

  return false;
}

// Editor input handling
if (editor) {
  editor.addEventListener("input", function () {
    updateButtonsEnabledState();
  });
}

// Parse button
if (parseBtn) {
  parseBtn.addEventListener("click", function () {
    detectFormatting();
  });
}

// Generate button
if (generateBtn) {
  generateBtn.addEventListener("click", function () {
    generateTaggedOutput();
  });
}

// Copy output button - copies plain text with tags from output editor
if (copyBtn) {
  copyBtn.addEventListener("click", function () {
    var plainText = outputEditor.textContent || "";
    if (!plainText) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(plainText).then(
        function () {
          copyStatus.textContent = "Copied.";
          window.setTimeout(function () {
            copyStatus.textContent = "";
          }, 2000);
        },
        function () {
          copyStatus.textContent = "Unable to copy. You can copy manually.";
        }
      );
    } else {
      var textarea = document.createElement("textarea");
      textarea.value = plainText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var ok = document.execCommand("copy");
        if (ok) {
          copyStatus.textContent = "Copied.";
        } else {
          copyStatus.textContent = "Unable to copy. You can copy manually.";
        }
      } catch (e) {
        copyStatus.textContent = "Unable to copy. You can copy manually.";
      }
      document.body.removeChild(textarea);
      window.setTimeout(function () {
        copyStatus.textContent = "";
      }, 2000);
    }
  });
}

// Render a visual preview with tags highlighted, given a plain tagged string
function renderPreviewFromText(taggedText) {
  if (!outputPreview) return;
  outputPreview.innerHTML = "";

  var frag = document.createDocumentFragment();
  var buffer = "";

  for (var i = 0; i < taggedText.length; i++) {
    var ch = taggedText[i];
    if (ch === "<") {
      // flush any accumulated plain text
      if (buffer) {
        frag.appendChild(document.createTextNode(buffer));
        buffer = "";
      }
      // read until closing ">"
      var end = taggedText.indexOf(">", i);
      if (end === -1) {
        buffer += taggedText.slice(i);
        break;
      }
      var token = taggedText.slice(i, end + 1);
      var span = document.createElement("span");
      span.className = "semantic-tag";
      span.textContent = token;
      frag.appendChild(span);
      i = end;
    } else {
      buffer += ch;
    }
  }

  if (buffer) {
    frag.appendChild(document.createTextNode(buffer));
  }

outputPreview.appendChild(frag);
}

// Theme toggle events
if (lightThemeBtn) {
  lightThemeBtn.addEventListener("click", function () {
    setTheme("light");
  });
}
if (darkThemeBtn) {
  darkThemeBtn.addEventListener("click", function () {
    setTheme("dark");
  });
}

// Initial button state
updateButtonsEnabledState();

// Feedback logic
function openFeedbackModal(kind) {
  if (!feedbackModal) return;
  feedbackTypeField.value = kind;
  feedbackEmailInput.value = "";
  feedbackModal.classList.add("is-open");
  feedbackModal.setAttribute("aria-hidden", "false");
  feedbackEmailInput.focus();
}

function closeFeedbackModal() {
  if (!feedbackModal) return;
  feedbackModal.classList.remove("is-open");
  feedbackModal.setAttribute("aria-hidden", "true");
}

function sendFeedback(kind, email) {
  var payload = {
    type: kind,
    email: email || "",
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent || ""
  };

  var db = window._retainformatDb;

  // If Firebase is not configured, just log locally and show a friendly message.
  if (!db) {
    console.log("Feedback payload (Firebase not configured):", payload);
    if (feedbackStatus) {
      feedbackStatus.textContent = "Thanks for your feedback.";
      setTimeout(function () {
        feedbackStatus.textContent = "";
      }, 2500);
    }
    return;
  }

  db.collection("feedbackEvents")
    .add(payload)
    .then(function () {
      if (!feedbackStatus) return;
      feedbackStatus.textContent = "Thanks for your feedback.";
      setTimeout(function () {
        feedbackStatus.textContent = "";
      }, 2500);
    })
    .catch(function (err) {
      console.error("Error writing feedback to Firebase:", err);
      if (!feedbackStatus) return;
      feedbackStatus.textContent =
        "Feedback not saved (network issue).";
      setTimeout(function () {
        feedbackStatus.textContent = "";
      }, 2500);
    });
}

if (feedbackLikeBtn) {
  feedbackLikeBtn.addEventListener("click", function () {
    openFeedbackModal("like");
  });
}

if (feedbackDislikeBtn) {
  feedbackDislikeBtn.addEventListener("click", function () {
    openFeedbackModal("dislike");
  });
}

if (feedbackQuestionBtn) {
  feedbackQuestionBtn.addEventListener("click", function () {
    openFeedbackModal("question");
  });
}

if (feedbackCancelBtn) {
  feedbackCancelBtn.addEventListener("click", function () {
    var kind = feedbackTypeField.value || "unknown";
    closeFeedbackModal();
    sendFeedback(kind, "");
  });
}

if (feedbackForm) {
  feedbackForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var kind = feedbackTypeField.value || "unknown";
    var email = (feedbackEmailInput.value || "").trim();
    closeFeedbackModal();
    sendFeedback(kind, email);
  });
}

