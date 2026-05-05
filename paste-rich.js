// Shared HTML paste sanitization + insertion (used by Text to Tags and Post-ready text).
var DANGEROUS_TAGS = {
  SCRIPT: true,
  IFRAME: true,
  OBJECT: true,
  EMBED: true,
  FORM: true,
  LINK: true,
};
var BLOCK_TAGS = {
  TABLE: true,
  TBODY: true,
  THEAD: true,
  TR: true,
  TD: true,
  TH: true,
  DIV: true,
  P: true,
  CENTER: true,
};
var HEADING_TAGS = {
  H1: true,
  H2: true,
  H3: true,
  H4: true,
  H5: true,
  H6: true,
};

function isPageBackgroundColor(bg) {
  if (!bg || typeof bg !== "string") return true;
  var s = bg.toLowerCase().trim();
  if (s === "transparent") return true;
  if (/^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(s)) return true;
  if (
    s === "white" ||
    s === "#fff" ||
    s === "#ffffff" ||
    s === "rgb(255, 255, 255)" ||
    s === "rgb(255,255,255)"
  )
    return true;
  if (/^rgba?\s*\(\s*255\s*,\s*255\s*,\s*255\s*/.test(s)) return true;
  if (
    s === "black" ||
    s === "#000" ||
    s === "#000000" ||
    s === "rgb(0, 0, 0)" ||
    s === "rgb(0,0,0)"
  )
    return true;
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
    if (
      (prop === "background-color" || prop === "background") &&
      isPageBackgroundColor(val)
    )
      continue;
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
      var bgPart =
        bg && !isPageBackgroundColor(bg)
          ? " background-color: " + bg + ";"
          : "";
      return (c ? "color: " + c + ";" : "") + bgPart;
    }
  }
  return "";
}

function clonePasteIntoEditor(html, editorEl) {
  var doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html;

  var styleNodes = doc.body.querySelectorAll("style");
  for (var s = 0; s < styleNodes.length; s++) {
    var css = (styleNodes[s].textContent || "")
      .replace(/javascript\s*:/gi, "")
      .replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(");
    if (css.trim()) {
      var styleEl = document.createElement("style");
      styleEl.setAttribute("data-pasted", "1");
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  var sel = window.getSelection();
  var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if (
    !range ||
    (!editorEl.contains(range.commonAncestorContainer) &&
      range.commonAncestorContainer !== editorEl)
  ) {
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
      var hStyle = node.getAttribute("style") || "";
      if (hs && hs.color) hStyle = "color: " + hs.color + ";" + hStyle;
      if (
        hs &&
        hs.backgroundColor &&
        !isPageBackgroundColor(hs.backgroundColor)
      ) {
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
        if (color && color !== "rgb(0, 0, 0)" && color !== "rgba(0, 0, 0, 0)")
          parts.push("color: " + color);
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
      if (
        aname === "href" &&
        (attr.value || "").toLowerCase().indexOf("javascript:") === 0
      )
        continue;
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
    if (n.nodeType === Node.ELEMENT_NODE && n.tagName.toUpperCase() === "STYLE")
      continue;
    cloneInto(n, frag);
  }
  range.deleteContents();
  range.insertNode(frag);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
