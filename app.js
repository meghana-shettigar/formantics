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
// Each entry: { id, kind, key, displayName, userLabel, priority, layer }
var detectedFormats = [];

// Format priority for ordering when multiple formats apply (lower number = higher priority)
// Structural (Lists, headings, tables, sections) = highest; Semantic emphasis (Bold, highlight) = medium; Visual (Font, color, underline) = lowest
var FORMAT_LAYERS = {
  structural: 0,   // Highest: lists, headings, tables, sections
  semantic: 1,     // Medium: bold, highlight, italic
  visual: 2        // Lowest: font, color, underline, alignment
};
function getFormatPriority(kind) {
  var structural = ["bullet", "heading", "table", "section"];
  var semantic = ["bold", "highlight", "italic"];
  var visual = ["color", "underline", "alignment"];
  if (structural.indexOf(kind) !== -1) return FORMAT_LAYERS.structural;
  if (semantic.indexOf(kind) !== -1) return FORMAT_LAYERS.semantic;
  if (visual.indexOf(kind) !== -1) return FORMAT_LAYERS.visual;
  return FORMAT_LAYERS.visual;
}
function getFormatLayerName(kind) {
  var p = getFormatPriority(kind);
  if (p === FORMAT_LAYERS.structural) return "structural";
  if (p === FORMAT_LAYERS.semantic) return "semantic";
  return "visual";
}
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

  // Update toggle buttons (role="radio" uses aria-checked)
  if (isLight) {
    lightThemeBtn.classList.add("is-active");
    darkThemeBtn.classList.remove("is-active");
    lightThemeBtn.disabled = true;
    darkThemeBtn.disabled = false;
    lightThemeBtn.setAttribute("aria-checked", "true");
    darkThemeBtn.setAttribute("aria-checked", "false");
  } else {
    darkThemeBtn.classList.add("is-active");
    lightThemeBtn.classList.remove("is-active");
    darkThemeBtn.disabled = true;
    lightThemeBtn.disabled = false;
    darkThemeBtn.setAttribute("aria-checked", "true");
    lightThemeBtn.setAttribute("aria-checked", "false");
  }

  // Reset cached defaults so they are recalculated under the new theme
  editorDefaultColor = null;
  editorDefaultTextAlign = null;
}

// ——— Format detection: one function per format (same logic as before) ———

/** Detects bold (B/STRONG or font-weight >= 600). */
function detectBold(el, tag, style, found) {
  if (tag === "B" || tag === "STRONG") {
    found.bold = true;
    return;
  }
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

/** Detects italic (I/EM or font-style italic/oblique). */
function detectItalic(el, tag, style, found) {
  if (tag === "I" || tag === "EM" || style.fontStyle === "italic" || style.fontStyle === "oblique") {
    found.italic = true;
  }
}

/** Detects underline (text-decoration). */
function detectUnderline(el, tag, style, found) {
  var textDecoration = style.textDecorationLine || style.textDecoration;
  if (textDecoration && textDecoration.indexOf("underline") !== -1) {
    found.underline = true;
  }
}

/** Detects heading levels (H1–H6). */
function detectHeadings(el, tag, style, found) {
  if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6") {
    found.headings[tag] = true;
  }
}

/** Detects font color (non-default text color). */
function detectFontColor(el, tag, style, found) {
  var color = style.color;
  if (color && color !== editorDefaultColor && color !== "rgb(0, 0, 0)") {
    found.colors[color] = true;
  }
}

/** Detects highlights (background color, e.g. Word/Docs highlighter). */
function detectHighlights(el, tag, style, found) {
  var bg = style.backgroundColor;
  if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
    found.highlights[bg] = true;
  }
}

/** Detects text alignment on block-level elements. */
function detectAlignment(el, tag, style, found) {
  var alignValue = style.textAlign;
  if (alignValue && alignValue !== editorDefaultTextAlign) {
    found.alignments[alignValue] = true;
  }
}

/** Count how many UL/OL ancestors an element has (list nesting depth). Stop when we hit the editor. */
function getListDepth(node) {
  var d = 0;
  var p = node && node.parentElement;
  while (p && p !== editor) {
    if (p.tagName === "UL" || p.tagName === "OL") d++;
    p = p.parentElement;
  }
  return d;
}

/** Detects list-style-type on list items. Key = listStyleType + "_L" + getListDepth(el) so depth 1 = top-level, 2 = nested. */
function detectBullets(el, tag, style, found) {
  if (tag !== "LI") return;
  var listStyleType = (style.listStyleType || "").trim().toLowerCase();
  if (!listStyleType || listStyleType === "none") listStyleType = "disc";
  if (!found.bullets) found.bullets = {};
  var depth = getListDepth(el);
  var key = listStyleType + "_L" + depth;
  found.bullets[key] = true;
}

// Main formatting detection: walks editor and calls each detector.
function detectFormatting() {
  ensureEditorDefaults();

  var found = {
    bold: false,
    italic: false,
    underline: false,
    headings: {},
    colors: {},
    highlights: {},
    alignments: {}
  };

  var walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  var rootElements = [editor];
  while (walker.nextNode()) {
    rootElements.push(walker.currentNode);
  }

  for (var i = 0; i < rootElements.length; i++) {
    var el = rootElements[i];
    if (el === editor) {
      var editorStyle = window.getComputedStyle(editor);
      detectAlignment(el, "DIV", editorStyle, found);
      continue;
    }

    var tag = el.tagName;
    var style = window.getComputedStyle(el);

    detectBold(el, tag, style, found);
    detectItalic(el, tag, style, found);
    detectUnderline(el, tag, style, found);
    detectHeadings(el, tag, style, found);
    detectFontColor(el, tag, style, found);
    detectHighlights(el, tag, style, found);
    detectAlignment(el, tag, style, found);
    detectBullets(el, tag, style, found);
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
    var layerName = getFormatLayerName(kind);
    //var layerLabel = layerName === "structural" ? "Structural" : layerName === "semantic" ? "Semantic" : "Visual";
    var layerHint = document.createElement("span");
    //layerHint.className = "detected-layer detected-layer-" + layerName;
    layerHint.setAttribute("title", layerName === "structural" ? "Highest priority" : layerName === "semantic" ? "Medium priority" : "Lowest priority");
    //layerHint.textContent = layerLabel;
    labelEl.appendChild(document.createTextNode(label));
    labelEl.appendChild(layerHint);

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
      userLabel: "",
      priority: getFormatPriority(kind),
      layer: getFormatLayerName(kind)
    };
    detectedFormats.push(formatEntry);

    input.addEventListener("input", function () {
      formatEntry.userLabel = input.value;
      updateButtonsEnabledState();
    });
  }

  /** UI for Bold format. */
  function addBoldFormatUI() {
    if (!found.bold) return;
    addFormat("bold", "bold", "Bold", function (preview) {
      var span = document.createElement("span");
      span.style.fontWeight = "700";
      span.textContent = "Bold text";
      preview.appendChild(span);
    });
  }

  /** UI for Italic format. */
  function addItalicFormatUI() {
    if (!found.italic) return;
    addFormat("italic", "italic", "Italic", function (preview) {
      var span = document.createElement("span");
      span.style.fontStyle = "italic";
      span.textContent = "Italic text";
      preview.appendChild(span);
    });
  }

  /** UI for Underline format. */
  function addUnderlineFormatUI() {
    if (!found.underline) return;
    addFormat("underline", "underline", "Underline", function (preview) {
      var span = document.createElement("span");
      span.style.textDecoration = "underline";
      span.textContent = "Underlined text";
      preview.appendChild(span);
    });
  }

  /** UI for Heading formats (H1–H6). */
  function addHeadingsFormatUI() {
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
  }

  /** UI for Font color formats. */
  function addColorFormatsUI() {
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
  }

  /** UI for Highlight (background color) formats. */
  function addHighlightFormatsUI() {
    for (var bg in found.highlights) {
      if (Object.prototype.hasOwnProperty.call(found.highlights, bg)) {
      (function (b) {
        addFormat("highlight", b, "Highlight", function (preview) {
          var span = document.createElement("span");
          span.className = "color-swatch";
          span.style.backgroundColor = b;
          span.style.padding = "2px 6px";
          span.textContent = "";
          preview.appendChild(span);
        });
      })(bg);
    }
  }
  }

  /** UI for Alignment formats. */
  function addAlignmentFormatsUI() {
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
  }

  /** Map list-style-type to display character for bullet UI. */
  var BULLET_DISPLAY = {
    disc: "•",
    circle: "◦",
    round: "◦",
    square: "▪",
    decimal: "1.",
    "decimal-leading-zero": "01.",
    "lower-alpha": "a.",
    "upper-alpha": "A.",
    "lower-roman": "i.",
    "upper-roman": "I."
  };

  /** Human-readable names for list-style-type (for accessibility and visibility). */
  var BULLET_LABELS = {
    disc: "filled round •",
    circle: "hollow round ◦",
    round: "hollow round ◦",
    square: "square ▪",
    decimal: "numbered 1.",
    "decimal-leading-zero": "01.",
    "lower-alpha": "a.",
    "upper-alpha": "A.",
    "lower-roman": "i.",
    "upper-roman": "I."
  };

  /** UI for Bullet/list formats. Key may be "disc_L1" (depth) so top-level and nested are separate. */
  function addBulletFormatsUI() {
    if (!found.bullets) return;
    // console.log("[RetainFormat] Detected bullet keys (Parse):", Object.keys(found.bullets));
    for (var fullKey in found.bullets) {
      if (!Object.prototype.hasOwnProperty.call(found.bullets, fullKey)) continue;
      (function (key) {
        var baseKey = key.replace(/_L\d+$/, "");
        var depthMatch = key.match(/_L(\d+)$/);
        var depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        var displayChar = BULLET_DISPLAY[baseKey] != null ? BULLET_DISPLAY[baseKey] : baseKey;
        var shortLabel = BULLET_LABELS[baseKey] != null ? BULLET_LABELS[baseKey] : baseKey;
        var levelHint = depth <= 1 ? " (top level)" : " (nested)";
        var label = "Bullet: " + shortLabel + levelHint;
        addFormat("bullet", key, label, function (preview) {
          var wrap = document.createElement("span");
          wrap.style.display = "inline-flex";
          wrap.style.alignItems = "center";
          wrap.style.gap = "6px";
          var bulletSpan = document.createElement("span");
          bulletSpan.style.fontSize = "1.75em";
          bulletSpan.style.lineHeight = "1";
         // bulletSpan.style.minWidth = "1.2em";
          bulletSpan.textContent = displayChar;
          bulletSpan.setAttribute("aria-hidden", "true");
          wrap.appendChild(bulletSpan);
          // var textSpan = document.createElement("span");
          // textSpan.textContent = " " + shortLabel + levelHint;
          // textSpan.textContent = " ";
          // textSpan.setAttribute("aria-hidden", "true");
          // console.log("textSpan megha1", textSpan);
          // console.log("wrap megha2", wrap);
          // wrap.appendChild(textSpan);
          // console.log("preview megha3", preview);
          preview.appendChild(wrap);
        });
      })(fullKey);
    }
  }

  addBoldFormatUI();
  addItalicFormatUI();
  addUnderlineFormatUI();
  addHeadingsFormatUI();
  addColorFormatsUI();
  addHighlightFormatsUI();
  addAlignmentFormatsUI();
  addBulletFormatsUI();

  if (!anyDetected) {
    detectedFormattingContainer.classList.add("empty-state");
    var msg = document.createElement("p");
    msg.className = "empty-message";
    msg.textContent =
      "No special formatting detected. Try adding bold, color, headings, bullets, or alignment.";
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
  // Apply priority: structural first, then semantic, then visual (so tags open/close in layer order)
  activeFormats = activeFormats.slice().sort(function (a, b) {
    return (a.priority || FORMAT_LAYERS.visual) - (b.priority || FORMAT_LAYERS.visual);
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

  // ——— DEBUG: bullet / list state ———
  (function debugBullets() {
    //console.group("[RetainFormat] Bullet / list debug");
    // console.log("activeFormats (bullet only):", activeFormats.filter(function (f) { return f.kind === "bullet"; }).map(function (f) { return { key: f.key, userLabel: f.userLabel }; }));
    var liElements = editor.querySelectorAll("li");
    // console.log("Total <li> in editor:", liElements.length);
    for (var i = 0; i < liElements.length; i++) {
      var li = liElements[i];
      var parent = li.parentElement;
      var tag = parent ? parent.tagName : "?";
      var text = (li.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      // console.log("  LI " + (i + 1) + ": parent=" + tag + ", depth=" + getListDepth(li) + ", text~=" + JSON.stringify(text));
    }
    console.groupEnd();
  })();

  // Build map: LI element -> { key, index }. Use Map so DOM elements are keys by reference (plain object would stringify them to "[object HTMLLIElement]" and overwrite).
  var liToBulletInfo = new Map();
  var liSegmentMap = {};
  var liElements = editor.querySelectorAll("li");
  //console.group("[RetainFormat] ASSIGNMENT: building liToBulletInfo (each LI -> key, index)");
  for (var liIdx = 0; liIdx < liElements.length; liIdx++) {
    var li = liElements[liIdx];
    var parent = li.parentElement;
    if (!parent || (parent.tagName !== "UL" && parent.tagName !== "OL")) continue;
    var liStyle = window.getComputedStyle(li);
    var listStyleType = (liStyle.listStyleType || "disc").trim().toLowerCase();
    if (listStyleType === "none") listStyleType = "disc";
    var depth = getListDepth(li);
    var key = listStyleType + "_L" + depth;
    var siblings = [];
    for (var s = 0; s < parent.children.length; s++) {
      if (parent.children[s].tagName === "LI") siblings.push(parent.children[s]);
    }
    var indexInList = siblings.indexOf(li) + 1;
    // console.log("  ASSIGN liIdx=" + liIdx + " text=" + JSON.stringify((li.textContent || "").trim().slice(0, 15)) + " | getListDepth(li)=" + depth + " listStyleType=" + listStyleType + " -> key=" + key + " | siblings.length=" + siblings.length + " indexInList=" + indexInList);
    liToBulletInfo.set(li, { key: key, index: indexInList });
  }
  console.groupEnd();
  // --- LOG: every var between building liToBulletInfo and ASSIGN label ---
  //console.group("[RetainFormat] TRACE: vars from liToBulletInfo build -> ASSIGN label");
  var topLevelKey = null;
  for (var i = 0; i < liElements.length; i++) {
    var info = liToBulletInfo.get(liElements[i]);
    var liTextI = (liElements[i].textContent || "").trim().slice(0, 12);
    var keySuffix = info ? info.key.slice(-3) : "n/a";
    var isL1 = !!(info && info.key.length >= 3 && info.key.slice(-3) === "_L1");
    // console.log("  topLevelKey loop i=" + i + " liText=" + JSON.stringify(liTextI) + " info.key=" + (info ? info.key : "?") + " key.slice(-3)=" + keySuffix + " isL1=" + isL1);
    if (info && info.key.length >= 3 && info.key.slice(-3) === "_L1") {
      topLevelKey = info.key;
    //  console.log("  -> ASSIGN topLevelKey=" + topLevelKey + " (break)");
      break;
    }
  }
  //console.log("  FINAL topLevelKey=" + topLevelKey);
  var docOrder = [];
  if (topLevelKey) {
    for (var j = 0; j < liElements.length; j++) {
      var inf = liToBulletInfo.get(liElements[j]);
      var liTextJ = (liElements[j].textContent || "").trim().slice(0, 12);
      var match = !!(inf && inf.key === topLevelKey);
    //  console.log("  docOrder loop j=" + j + " liText=" + JSON.stringify(liTextJ) + " inf.key=" + (inf ? inf.key : "?") + " match=" + match);
      if (inf && inf.key === topLevelKey) docOrder.push(liElements[j]);
    }
    //console.log("  ASSIGN docOrder.length=" + docOrder.length);
    for (var k = 0; k < docOrder.length; k++) {
      var docEntry = liToBulletInfo.get(docOrder[k]);
      var oldIndex = docEntry.index;
      docEntry.index = k + 1;
    //  console.log("  renumber k=" + k + " docOrder[k].text=" + JSON.stringify((docOrder[k].textContent || "").trim().slice(0, 12)) + " ASSIGN index " + (k + 1) + " (was " + oldIndex + ")");
    }
  }
  var bulletInfoByIndex = [];
  for (var b = 0; b < liElements.length; b++) {
    var fromMap = liToBulletInfo.get(liElements[b]);
    bulletInfoByIndex[b] = fromMap;
   // console.log("  bulletInfoByIndex b=" + b + " liText=" + JSON.stringify((liElements[b].textContent || "").trim().slice(0, 12)) + " ASSIGN from liToBulletInfo[liElements[b]] -> key=" + (fromMap ? fromMap.key : "?") + " index=" + (fromMap ? fromMap.index : "?"));
  }
  var getBulletInfoCallCount = 0;
  function getBulletInfoForLI(li) {
    var liT = (li && li.textContent) ? (li.textContent || "").trim().slice(0, 12) : "?";
    var foundIdx = -1;
    for (var idx = 0; idx < liElements.length; idx++) {
      if (liElements[idx] === li) {
        foundIdx = idx;
        break;
      }
    }
    var ret = foundIdx >= 0 ? bulletInfoByIndex[foundIdx] : liToBulletInfo.get(li);
    getBulletInfoCallCount++;
    if (getBulletInfoCallCount <= 20) {
    //  console.log("  getBulletInfoForLI call#" + getBulletInfoCallCount + " liText=" + JSON.stringify(liT) + " foundIdx=" + foundIdx + " ret.key=" + (ret ? ret.key : "?") + " ret.index=" + (ret ? ret.index : "?"));
    }
    return ret;
  }
  console.groupEnd();
  // For LIs that contain nested UL/OL, build segment map: content starts new segment (1=A, 2=B, 3=C, 4=D); UL joins current segment (first UL -> 2, second UL -> 4).
  for (var liIdx = 0; liIdx < liElements.length; liIdx++) {
    var li = liElements[liIdx];
    var hasNested = li.querySelector("ul, ol");
    if (!hasNested) continue;
    var map = {};
    var segIdx = 1;
    var childNodes = li.childNodes;
    for (var c = 0; c < childNodes.length; c++) {
      var child = childNodes[c];
      var isList = child.nodeType === Node.ELEMENT_NODE && (child.tagName === "UL" || child.tagName === "OL");
      //console.log("child megha4", child);
      //console.log("isList megha5", isList);
      if (isList) {
        map[child] = segIdx;
      } else {
       // console.log("child megha6", child);
        //console.log("segIdx megha7", segIdx);
        map[child] = segIdx;
        segIdx++;
      }
    }
    liSegmentMap[li] = map;
  }

  // ——— DEBUG: liToBulletInfo and liSegmentMap ———
  (function debugMaps() {
    //console.group("[RetainFormat] liToBulletInfo & liSegmentMap");
    var liList = editor.querySelectorAll("li");
    for (var i = 0; i < liList.length; i++) {
      var li = liList[i];
      var infoByLi = liToBulletInfo.get(li);
      var infoByElements = liToBulletInfo.get(liElements[i]);
      var sameRef = li === liElements[i];
      var seg = liSegmentMap[li];
      var text = (li.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
      //console.log("i=" + i + " text=" + JSON.stringify(text) + " | sameRef(li===liElements[i])=" + sameRef + " | infoByLi.key=" + (infoByLi ? infoByLi.key : "none") + " | infoByElements.key=" + (infoByElements ? infoByElements.key : "none") + (seg ? " | segMap" : ""));
    }
    console.groupEnd();
  })();

  // Helper: get segment index for a text node under an LI that has a segment map (used when one LI wraps multiple logical items)
  function getSegmentIndexForNode(li, textNode) {
    var map = liSegmentMap[li];
    if (!map) return null;
    var node = textNode;
    while (node && node.parentElement !== li) {
      node = node.parentElement;
    }
    if (!node) return null;
    return map[node] != null ? map[node] : null;
  }

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
      var nodeLabels = allFormatsForTextNode(current, activeFormats, getBulletInfoForLI, getSegmentIndexForNode);
      nodes.push({ type: "text", node: current, text: text });
      labelsPerIndex.push(nodeLabels);
    }
  }

  // ——— DEBUG: per-text-node labels ———
  (function debugNodeLabels() {
    //console.group("[RetainFormat] Text node -> labels");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === "br") {
        //console.log("  [br] -> []");
        continue;
      }
      var t = (nodes[i].text || "").replace(/\s/g, "·").slice(0, 20);
      //console.log("  " + JSON.stringify(t) + " -> " + JSON.stringify(labelsPerIndex[i]));
    }
    console.groupEnd();
  })();

  // Compute span length (first/last index) for each label so we can order outer vs inner tags
  var spanStart = {};
  var spanEnd = {};
  for (var i = 0; i < labelsPerIndex.length; i++) {
    var labels = labelsPerIndex[i];
    for (var li = 0; li < labels.length; li++) {
      var lbl = labels[li];
      if (spanStart[lbl] === undefined) {
        spanStart[lbl] = i;
        //console.log("spanStart megha8", spanStart);
      }
      spanEnd[lbl] = i;
      //console.log("spanEnd megha9", spanEnd);
    }
  }

  // Helper: Get the DOM element that has a specific format for a text node
  function getFormatElement(textNode, formatLabel) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
    var fmt = activeFormats.find(function (f) {
      if (f.userLabel === formatLabel) return true;
      if (f.kind === "bullet" && formatLabel.indexOf(f.userLabel + " ") === 0) return true;
     // console.log("f megha16", f);
      return false;
    });
    if (!fmt) return null;
    //console.log("fmt megha15", fmt);

    var el = textNode.parentElement;
    if (!el) return null;
    //console.log("el megha10", el);
    // Check if this element or an ancestor has the format
    var checkEl = el;
    while (checkEl && checkEl !== editor.parentNode) {
      var style = window.getComputedStyle(checkEl);
      var defaultColor = editorDefaultColor;
      var defaultAlign = editorDefaultTextAlign;
      var defaultWeight = editorDefaultWeight;
     // console.log("style megha11", style);
     // console.log("defaultColor megha12", defaultColor);
     // console.log("defaultAlign megha13", defaultAlign);
     // console.log("defaultWeight megha14", defaultWeight);
      var matches = false;
      if (fmt.kind === "bold") {
        var weightStr = style.fontWeight;
        var weightNum = parseInt(weightStr, 10);
        var defaultNum =
          typeof editorDefaultWeight === "number"
            ? editorDefaultWeight
            : parseInt(editorDefaultWeight, 10);
        if (!isNaN(weightNum) && weightNum >= 600 && (!defaultNum || weightNum > defaultNum)) {
          matches = true;
        } else {
          var tag = checkEl.tagName;
          if (tag === "B" || tag === "STRONG") {
            matches = true;
          }
        }
      } else if (fmt.kind === "italic") {
        if (style.fontStyle === "italic" || style.fontStyle === "oblique") {
          matches = true;
        } else {
          var tagIt = checkEl.tagName;
          if (tagIt === "I" || tagIt === "EM") {
            matches = true;
          }
        }
      } else if (fmt.kind === "underline") {
        var textDecoration = style.textDecorationLine || style.textDecoration;
        if (textDecoration && textDecoration.indexOf("underline") !== -1) {
          matches = true;
        }
      } else if (fmt.kind === "heading") {
        if (checkEl.tagName === fmt.key) {
          matches = true;
        }
      } else if (fmt.kind === "color") {
        var color = style.color;
        if (
          color &&
          color !== defaultColor &&
          color !== "rgb(0, 0, 0)" &&
          color === fmt.key
        ) {
          matches = true;
        }
      } else if (fmt.kind === "highlight") {
        var bg = style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg === fmt.key) {
          matches = true;
        }
      } else if (fmt.kind === "alignment") {
        var align = style.textAlign;
        if (align && align !== defaultAlign && align === fmt.key) {
          matches = true;
        }
      } else if (fmt.kind === "bullet" && checkEl.tagName === "LI") {
        var bulletInfo = getBulletInfoForLI(checkEl);
        if (bulletInfo) {
          var indexForLabel = bulletInfo.index;
          if (liSegmentMap[checkEl]) {
            var seg = getSegmentIndexForNode(checkEl, textNode);
            //console.log("seg megha17", seg);
            if (seg != null) indexForLabel = seg;
          }
          if (bulletInfo.key === fmt.key && (fmt.userLabel + " " + indexForLabel) === formatLabel) {
            //console.log("matches megha18", matches);
            matches = true;
          }
        }
      }

      if (matches) {
        return checkEl;
      }
      checkEl = checkEl.parentElement;
    }
    return null;
  }

  // Helper: Determine nesting order for labels at a specific text node
  // Returns labels sorted outer-to-inner based on DOM nesting
  function getNestedOrder(textNode, labels) {
    if (labels.length <= 1) return labels;

    // Get the element for each label
    var labelElements = {};
    for (var li = 0; li < labels.length; li++) {
      var lbl = labels[li];
      labelElements[lbl] = getFormatElement(textNode, lbl);
    }

    // Sort by DOM nesting: outer elements first (comparator must be consistent to avoid infinite sort loop)
    return labels.slice().sort(function (a, b) {
      var elA = labelElements[a];
      var elB = labelElements[b];
      if (!elA && !elB) return 0;
      if (!elA) return 1;
      if (!elB) return -1;
      if (elA === elB) return 0;

      // Check if A contains B (A is outer)
      var check = elB;
      while (check && check !== editor.parentNode) {
        if (check === elA) return -1; // A contains B, so A is outer
        check = check.parentElement;
      }

      // Check if B contains A (B is outer)
      check = elA;
      while (check && check !== editor.parentNode) {
        if (check === elB) return 1; // B contains A, so B is outer
        check = check.parentElement;
      }

      // If neither contains the other, use span length as fallback
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
  }

  // Tag is a bullet tag if it looks like "label N" (e.g. "main 1", "sub 2")
  function isBulletTag(tagName) {
    return /^.+\s\d+$/.test(tagName);
  }

  // Priority for a tag string (used for open/close order: open structural first, close semantic/visual before structural).
  function getTagPriority(tag) {
    for (var fi = 0; fi < activeFormats.length; fi++) {
      var fmt = activeFormats[fi];
      if (tag === fmt.userLabel) return fmt.priority != null ? fmt.priority : FORMAT_LAYERS.visual;
      if (fmt.kind === "bullet" && tag.indexOf(fmt.userLabel + " ") === 0) return fmt.priority != null ? fmt.priority : FORMAT_LAYERS.structural;
    }
    return FORMAT_LAYERS.visual;
  }

  // List depth for a bullet tag (from format key e.g. disc_L1 -> 1). Non-bullet tags return 0 so they sort first by priority only.
  function getTagDepth(tag) {
    if (!isBulletTag(tag)) return 0;
    for (var fi = 0; fi < activeFormats.length; fi++) {
      var fmt = activeFormats[fi];
      if (fmt.kind === "bullet" && tag.indexOf(fmt.userLabel + " ") === 0) {
        var match = (fmt.key || "").match(/_L(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      }
    }
    return 0;
  }

  // Find the LI that owns this bullet tag (same logic as label assignment).
  // Find the LI that owns this bullet tag. Use the LI's bullet index (info.index) only, not segment index,
  // so we find the owner even when the current node is in a nested list under that LI (e.g. "A1" under "A").
  function getOwnerLIForBulletTag(textNode, bulletTag) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
    for (var ei = 0; ei < liElements.length; ei++) {
      var li = liElements[ei];
      var info = getBulletInfoForLI(li);
      if (!info) continue;
      var fmt = activeFormats.find(function (f) { return f.kind === "bullet" && f.key === info.key; });
      if (!fmt) continue;
      var label = fmt.userLabel + " " + info.index;
      if (label === bulletTag) return li;
    }
    return null;
  }

  // Like highlight: keep bullet tag open while current node is still inside the LI that owns that tag.
  // Only close when we've left that LI (so outer bullets close only after all inner bullets are closed).
  function isNodeInBulletScope(textNode, bulletTag) {
    var ownerLI = getOwnerLIForBulletTag(textNode, bulletTag);
    if (!ownerLI) return false;
    var n = textNode.parentElement;
    while (n && n !== editor.parentNode) {
      if (n === ownerLI) return true;
      n = n.parentElement;
    }
    return false;
  }

  var result = "";
  var openTags = [];

  //console.group("[TAG_OUTPUT] Build output: open/close/append per node (like highlight: open once, close when leaving scope)");

  for (var idx = 0; idx < nodes.length; idx++) {
    var item = nodes[idx];
    if (item.type === "br") {
      //console.log("[TAG_OUTPUT] idx=" + idx + " type=br -> ASSIGN result += \\n");
      result += "\n";
      continue;
    }

    var textNodeLabels = labelsPerIndex[idx];
    var currentNode = item.node;
    var textPreview = (item.text || "").replace(/\s/g, "·").slice(0, 25);

    //console.log("[TAG_OUTPUT] idx=" + idx + " text~=" + JSON.stringify(textPreview) + " | labels=" + JSON.stringify(textNodeLabels) + " | openTags(before close)=" + JSON.stringify(openTags));

    // Stack rule: outer tags go in first; don't close an outer (lower-depth) bullet until all inner (higher-depth) are closed.
    // So: only close a bullet tag if current labels do NOT contain any bullet with depth > this tag's depth.
    var minCloseIdx = openTags.length;
    for (var ci = 0; ci < openTags.length; ci++) {
      var tagToClose = openTags[ci];
      if (textNodeLabels.indexOf(tagToClose) !== -1) continue;
      if (isBulletTag(tagToClose)) {
        var depthOfTag = getTagDepth(tagToClose);
        var hasDeeperBulletInLabels = false;
        for (var li = 0; li < textNodeLabels.length; li++) {
          if (isBulletTag(textNodeLabels[li]) && getTagDepth(textNodeLabels[li]) > depthOfTag) {
            hasDeeperBulletInLabels = true;
            break;
          }
        }
        if (hasDeeperBulletInLabels) continue;
      } else if (isNodeInBulletScope(currentNode, tagToClose)) {
        continue;
      }
      if (ci < minCloseIdx) minCloseIdx = ci;
    }
    for (var cj = openTags.length - 1; cj >= minCloseIdx; cj--) {
      var t = openTags[cj];
      //console.log("  [TAG_OUTPUT] ASSIGN close tag: </" + t + ">");
      result += "</" + t + ">";
      if (isBulletTag(t)) result += "\n";
      openTags.splice(cj, 1);
    }
    //console.log("  [TAG_OUTPUT] openTags(after close)=" + JSON.stringify(openTags));

    // Determine which tags need to be opened (not already open)
    var tagsToOpen = [];
    for (var ti = 0; ti < textNodeLabels.length; ti++) {
      var tag = textNodeLabels[ti];
      if (openTags.indexOf(tag) === -1) {
        tagsToOpen.push(tag);
      }
    }

    // Open in order: priority (structural, semantic, visual), then for bullets by depth (depth 1, then 2, then 3), then DOM nesting.
    // So we open outer bullets before inner, and when we close in reverse order we close inner (higher depth) before outer.
    var nestedOrder = getNestedOrder(item.node, tagsToOpen);
    tagsToOpen.sort(function (a, b) {
      var pa = getTagPriority(a);
      var pb = getTagPriority(b);
      if (pa !== pb) return pa - pb;
      var da = getTagDepth(a);
      var db = getTagDepth(b);
      if (da !== db) return da - db;
      var ia = nestedOrder.indexOf(a);
      var ib = nestedOrder.indexOf(b);
      return ia - ib;
    });
    // console.log("  [TAG_OUTPUT] tagsToOpen=" + JSON.stringify(tagsToOpen) + " (priority then depth 1->2->3 then DOM)");

    // Open new tags (structural first, then semantic, then visual)
    for (var oi = 0; oi < tagsToOpen.length; oi++) {
      var tag = tagsToOpen[oi];
      if (isBulletTag(tag) && result.length > 0 && result.charAt(result.length - 1) !== "\n") {
        //console.log("  [TAG_OUTPUT] ASSIGN newline before bullet");
        result += "\n";
      }
      //console.log("  [TAG_OUTPUT] ASSIGN open tag: <" + tag + ">");
      result += "<" + tag + ">";
      openTags.push(tag);
    }
    //console.log("  [TAG_OUTPUT] openTags(after open)=" + JSON.stringify(openTags));
    //console.log("  [TAG_OUTPUT] ASSIGN append text: " + JSON.stringify(textPreview));

    // Append the actual text exactly as in input
    result += item.text;
  }

  // Close any remaining open tags at the end (reverse order = inner to outer; correct because we opened in priority order)
  // console.log("[TAG_OUTPUT] ASSIGN close remaining open tags (inner to outer): " + JSON.stringify(openTags));
  for (var cj = openTags.length - 1; cj >= 0; cj--) {
    //console.log("  [TAG_OUTPUT] ASSIGN close: </" + openTags[cj] + ">");
    result += "</" + openTags[cj] + ">";
    if (isBulletTag(openTags[cj])) result += "\n";
  }
  console.groupEnd();

  return result;
}

function allFormatsForTextNode(textNode, activeFormats, getBulletInfoForLI, getSegmentIndexForNode) {
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
    if (!label) continue;
    if (fmt.kind === "bullet") {
      if (!getBulletInfoForLI) continue;
      var anc = el;
      var ancestorLIs = [];
      while (anc && anc !== editor.parentNode) {
        if (anc.tagName === "LI") {
          var info = getBulletInfoForLI(anc);
          if (info) ancestorLIs.push(anc);
        }
        anc = anc.parentElement;
      }
      ancestorLIs.reverse();
      var textNodePreview = (textNode.nodeValue || "").trim().slice(0, 12);
      if (ancestorLIs.length > 0) {
        //console.log("[RetainFormat] allFormatsForTextNode textNode~=" + JSON.stringify(textNodePreview) + " ancestorLIs.length=" + ancestorLIs.length + " fmt.key=" + fmt.key);
      }
      for (var a = 0; a < ancestorLIs.length; a++) {
        var li = ancestorLIs[a];
        var bulletInfo = getBulletInfoForLI(li);
        var liPreview = (li.textContent || "").trim().slice(0, 12);
        //console.log("  a=" + a + " liText=" + JSON.stringify(liPreview) + " bulletInfo=" + (bulletInfo ? bulletInfo.key + "," + bulletInfo.index : "null") + " fmt.key=" + fmt.key + " match=" + (bulletInfo && bulletInfo.key === fmt.key));
        if (!bulletInfo || bulletInfo.key !== fmt.key) continue;
        var indexToUse = bulletInfo.index;
        if (getSegmentIndexForNode) {
          var segIdx = getSegmentIndexForNode(li, textNode);
          if (segIdx != null) indexToUse = segIdx;
        }
        var bulletLabel = fmt.userLabel + " " + indexToUse;
        if (labels.indexOf(bulletLabel) === -1) {
          //console.log("[RetainFormat] ASSIGN label: textNode~=" + JSON.stringify(textNodePreview) + " | fmt.key=" + fmt.key + " indexToUse=" + indexToUse + " -> push \"" + bulletLabel + "\"");
          labels.push(bulletLabel);
        }
      }
      continue;
    }
    if (labels.indexOf(label) !== -1) continue;

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
    } else if (fmt.kind === "highlight") {
      var bg = style.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg === fmt.key) {
        labels.push(label);
      } else {
        var nBg = el;
        while (nBg && nBg !== editor.parentNode) {
          var bgStyle = window.getComputedStyle(nBg);
          var bgVal = bgStyle.backgroundColor;
          if (bgVal && bgVal !== "transparent" && bgVal !== "rgba(0, 0, 0, 0)" && bgVal === fmt.key) {
            labels.push(label);
            break;
          }
          nBg = nBg.parentElement;
        }
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
      } else if (fmt.kind === "highlight") {
        var bg = style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg === fmt.key) {
          return true;
        }
      } else if (fmt.kind === "alignment") {
        var align = style.textAlign;
        if (align && align !== defaultAlign && align === fmt.key) {
          return true;
        }
      } else if (fmt.kind === "bullet" && tag === "LI") {
        var liStyle = window.getComputedStyle(el);
        var listStyleType = (liStyle.listStyleType || "disc").trim().toLowerCase();
        if (listStyleType === "none") listStyleType = "disc";
        var depth = getListDepth(el);
        var bulletKey = listStyleType + "_L" + depth;
        if (bulletKey === fmt.key) return true;
      }
    }

    if (!walker.nextNode()) {
      break;
    }
    current = walker.currentNode;
  }

  return false;
}

// Paste handling: preserve colors (including from <style>), collapse blocks to avoid extra spacing
var DANGEROUS_TAGS = { SCRIPT: true, IFRAME: true, OBJECT: true, EMBED: true, FORM: true, LINK: true };
var BLOCK_TAGS = { TABLE: true, TBODY: true, THEAD: true, TR: true, TD: true, TH: true, DIV: true, P: true, CENTER: true };
var HEADING_TAGS = { H1: true, H2: true, H3: true, H4: true, H5: true, H6: true };

// Treat as page background — do not paste; only highlight colors (e.g. yellow) should be kept
function isPageBackgroundColor(bg) {
  if (!bg || typeof bg !== "string") return true;
  var s = bg.toLowerCase().trim();
  if (s === "transparent") return true;
  if (/^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(s)) return true;
  if (s === "white" || s === "#fff" || s === "#ffffff" || s === "rgb(255, 255, 255)" || s === "rgb(255,255,255)") return true;
  if (/^rgba?\s*\(\s*255\s*,\s*255\s*,\s*255\s*/.test(s)) return true;
  if (s === "black" || s === "#000" || s === "#000000" || s === "rgb(0, 0, 0)" || s === "rgb(0,0,0)") return true;
  if (/^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*/.test(s)) return true;
  return false;
}

function filterBackgroundFromStyle(styleStr) {
  if (!styleStr || !styleStr.trim()) return styleStr || "";
  var parts = [];
  var decls = styleStr.split(";");
  for (var i = 0; i < decls.length; i++) {
    var d = decls[i].trim();
    if (!d) continue;
    var colon = d.indexOf(":");
    if (colon === -1) continue;
    var prop = d.substring(0, colon).trim().toLowerCase();
    var val = d.substring(colon + 1).trim();
    if ((prop === "background-color" || prop === "background") && isPageBackgroundColor(val)) continue;
    parts.push(d);
  }
  return parts.join("; ");
}

function getInlineStyleString(node) {
  var style = node.getAttribute("style");
  if (style) return filterBackgroundFromStyle(style);
  var tag = node.tagName.toUpperCase();
  if (tag === "FONT") {
    var c = node.getAttribute("color");
    var bg = node.getAttribute("bgcolor");
    if (c || bg) {
      var bgPart = (bg && !isPageBackgroundColor(bg)) ? " background-color: " + bg + ";" : "";
      return (c ? "color: " + c + ";" : "") + bgPart;
    }
  }
  return "";
}

function clonePasteIntoEditor(html, editorEl) {
  var doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html;

  // Extract <style> and inject into page so class-based colors (e.g. from email) work
  var styleNodes = doc.body.querySelectorAll("style");
  for (var s = 0; s < styleNodes.length; s++) {
    var css = (styleNodes[s].textContent || "").replace(/javascript\s*:/gi, "").replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(");
    if (css.trim()) {
      var styleEl = document.createElement("style");
      styleEl.setAttribute("data-pasted", "1");
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  var sel = window.getSelection();
  var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || (!editorEl.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== editorEl)) {
    range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(true);
  }

  function cloneInto(node, targetParent) {
    if (node.nodeType === Node.TEXT_NODE) {
      var t = node.textContent;
      if (t) targetParent.appendChild(document.createTextNode(t));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    var tag = node.tagName.toUpperCase();
    if (DANGEROUS_TAGS[tag]) {
      for (var i = 0; i < node.childNodes.length; i++) {
        cloneInto(node.childNodes[i], targetParent);
      }
      return;
    }
    if (tag === "STYLE") return;

    if (BLOCK_TAGS[tag]) {
      var blockStyle = getInlineStyleString(node);
      var wrap = document.createDocumentFragment();
      for (var j = 0; j < node.childNodes.length; j++) {
        cloneInto(node.childNodes[j], wrap);
      }
      if (blockStyle.trim()) {
        var span = document.createElement("span");
        span.setAttribute("style", blockStyle);
        while (wrap.firstChild) span.appendChild(wrap.firstChild);
        targetParent.appendChild(span);
      } else {
        targetParent.appendChild(wrap);
      }
      return;
    }

    if (tag === "BR") {
      targetParent.appendChild(document.createElement("br"));
      return;
    }

    var useSpan = tag === "FONT" || HEADING_TAGS[tag];
    var el = document.createElement(useSpan ? "span" : node.tagName);
    if (useSpan && HEADING_TAGS[tag]) {
      var hs = window.getComputedStyle ? window.getComputedStyle(node) : node.style;
      var hStyle = (node.getAttribute("style") || "");
      if (hs && hs.color) hStyle = "color: " + hs.color + ";" + hStyle;
      if (hs && hs.backgroundColor && !isPageBackgroundColor(hs.backgroundColor)) {
        hStyle = "background-color: " + hs.backgroundColor + ";" + hStyle;
      }
      if (hs && hs.fontWeight) hStyle = "font-weight: " + hs.fontWeight + ";" + hStyle;
      if (hs && hs.fontSize) hStyle = "font-size: " + hs.fontSize + ";" + hStyle;
      if (hStyle) el.setAttribute("style", hStyle);
    } else {
      var style = getInlineStyleString(node);
      if (style) {
        el.setAttribute("style", style);
      } else if (node.getAttribute("class") && window.getComputedStyle) {
        var cs = window.getComputedStyle(node);
        var color = cs.color;
        var bg = cs.backgroundColor;
        var parts = [];
        if (color && color !== "rgb(0, 0, 0)" && color !== "rgba(0, 0, 0, 0)") parts.push("color: " + color);
        if (bg && !isPageBackgroundColor(bg)) parts.push("background-color: " + bg);
        if (parts.length) el.setAttribute("style", parts.join("; "));
      }
    }
    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var aname = attr.name.toLowerCase();
      if (aname === "style") continue;
      if (aname === "color" || aname === "bgcolor") continue;
      if (aname.indexOf("on") === 0) continue;
      if (aname === "href" && (attr.value || "").toLowerCase().indexOf("javascript:") === 0) continue;
      try {
        el.setAttribute(attr.name, attr.value);
      } catch (err) {}
    }
    for (var k = 0; k < node.childNodes.length; k++) {
      cloneInto(node.childNodes[k], el);
    }
    targetParent.appendChild(el);
  }

  var frag = document.createDocumentFragment();
  for (var i = 0; i < doc.body.childNodes.length; i++) {
    var n = doc.body.childNodes[i];
    if (n.nodeType === Node.ELEMENT_NODE && n.tagName.toUpperCase() === "STYLE") continue;
    cloneInto(n, frag);
  }
  range.deleteContents();
  range.insertNode(frag);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

if (editor) {
  editor.addEventListener("input", function () {
    updateButtonsEnabledState();
  });

  editor.addEventListener("paste", function (e) {
    var html = e.clipboardData && e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      html = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object\b[\s\S]*?<\/object>/gi, "")
        .replace(/<embed\b[^>]*>/gi, "");
      if (html) {
        try {
          clonePasteIntoEditor(html, editor);
        } catch (err) {
          try {
            document.execCommand("insertHTML", false, html);
          } catch (err2) {
            editor.focus();
            document.execCommand("insertHTML", false, html);
          }
        }
        updateButtonsEnabledState();
      } else {
        var text = e.clipboardData.getData("text/plain");
        if (text) {
          document.execCommand("insertText", false, text);
          updateButtonsEnabledState();
        }
      }
    }
  });
}

// Parse button
if (parseBtn) {
  parseBtn.addEventListener("click", function () {
    if (window._retainformatTrackEvent) window._retainformatTrackEvent("parse_formatting");
    detectFormatting();
  });
}

// Generate button
if (generateBtn) {
  generateBtn.addEventListener("click", function () {
    if (window._retainformatTrackEvent) window._retainformatTrackEvent("generate_text");
    generateTaggedOutput();
  });
}

// Copy output button - copies plain text with tags from output editor
if (copyBtn) {
  copyBtn.addEventListener("click", function () {
    if (window._retainformatTrackEvent) window._retainformatTrackEvent("copy_output");
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

// Help tooltip
var helpTooltipBtn = document.getElementById("helpTooltipBtn");
var helpTooltipPopover = document.getElementById("helpTooltipPopover");

if (helpTooltipBtn && helpTooltipPopover) {
  helpTooltipBtn.addEventListener("click", function () {
    var isOpen = helpTooltipPopover.getAttribute("aria-hidden") !== "true";
    if (isOpen) {
      helpTooltipPopover.setAttribute("aria-hidden", "true");
      helpTooltipPopover.hidden = true;
      helpTooltipBtn.setAttribute("aria-expanded", "false");
    } else {
      helpTooltipPopover.setAttribute("aria-hidden", "false");
      helpTooltipPopover.hidden = false;
      helpTooltipBtn.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("click", function (e) {
    if (
      helpTooltipPopover.getAttribute("aria-hidden") === "true"
    ) return;
    if (
      helpTooltipBtn.contains(e.target) ||
      helpTooltipPopover.contains(e.target)
    ) return;
    helpTooltipPopover.setAttribute("aria-hidden", "true");
    helpTooltipPopover.hidden = true;
    helpTooltipBtn.setAttribute("aria-expanded", "false");
  });
}

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
    // console.log("Feedback payload (Firebase not configured):", payload);
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
      if (window._retainformatTrackEvent) {
        window._retainformatTrackEvent("feedback_" + kind, { email: email || "" });
      }
      if (!feedbackStatus) return;
      feedbackStatus.textContent = "Thanks for your feedback.";
      setTimeout(function () {
        feedbackStatus.textContent = "";
      }, 2500);
    })
    .catch(function (err) {
      console.warn("Feedback write failed:", err);
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

// ——— Analytics (no change to tool logic) ———
(function () {
  var STORAGE_VISITOR = "retainformat_visitor_id";
  var STORAGE_SESSION = "retainformat_session_id";
  var STORAGE_OWNER_FLAG = "retainformat_owner_flag";

  function randomId() {
    var hex = "0123456789abcdef";
    var s = "";
    for (var i = 0; i < 16; i++) s += hex[Math.floor(Math.random() * 16)];
    return s + Date.now().toString(36);
  }

  function getOrCreateVisitorId() {
    try {
      var id = localStorage.getItem(STORAGE_VISITOR);
      if (id) return id;
      id = randomId();
      localStorage.setItem(STORAGE_VISITOR, id);
      return id;
    } catch (e) {
      return randomId();
    }
  }

  function getOrCreateSessionId() {
    try {
      var id = sessionStorage.getItem(STORAGE_SESSION);
      if (id) return id;
      id = randomId();
      sessionStorage.setItem(STORAGE_SESSION, id);
      return id;
    } catch (e) {
      return randomId();
    }
  }

  function isOwnerBrowser() {
    try {
      return localStorage.getItem(STORAGE_OWNER_FLAG) === "1";
    } catch (e) {
      return false;
    }
  }

  function trackEvent(type, extra) {
    extra = extra || {};
    var db = window._retainformatDb;
    if (!db) return;
    var doc = {
      type: type,
      timestamp: new Date().toISOString(),
      visitorId: getOrCreateVisitorId(),
      sessionId: getOrCreateSessionId(),
      userAgent: navigator.userAgent || "",
      path: (window.location && window.location.pathname) || "",
      isOwner: isOwnerBrowser()
    };
    if (extra.email !== undefined) doc.email = extra.email;
    db.collection("analytics_events").add(doc).catch(function (err) {
      console.warn("Analytics event not saved:", err);
    });
  }

  window._retainformatTrackEvent = trackEvent;

  // Record page view on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      trackEvent("page_view");
    });
  } else {
    trackEvent("page_view");
  }
})();
