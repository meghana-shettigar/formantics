# Formantics – Formatting to Semantics for AI

Formantics is a small, focused web app that **converts visual formatting into explicit semantic tags that AI models can reliably understand**.  
Paste rich text from Word, Google Docs, PDFs, email, or the web and Formantics will preserve your formatting, let you assign meanings (like `Question`, `Answer`, `Time`, `Instruction`), and generate **AI‑ready tagged text** without changing the original order.

---

## Why Formantics exists

Most AI prompts throw away visual intent:

- Bold and italics used for emphasis
- Heading hierarchy
- Color‑coded meaning (e.g. red = answer, green = example)
- Alignment and other inline cues

Once pasted into a plain text prompt, that structure disappears and models must guess. **Formantics treats formatting as data** and turns it into clear semantic tags such as:

```text
<Question>What is your opinion?</Question>
<Answer>I think that is a valuable item.</Answer>
```

This makes prompts more robust, auditable, and easier to debug.

---

## Key features

### Rich text input (no formatting loss)

- Paste from **Word, Google Docs, PDFs, email, websites**, etc.
- Preserves:
  - Bold / strong
  - Italic / emphasis
  - Text color (per exact color)
  - Headings (H1–H6)
  - Underline
  - Alignment (e.g. centered headings)
- Uses a **contenteditable** editor so the DOM and inline formatting are preserved.

### Automatic formatting detection

- Analyses the pasted DOM and **only shows formats that actually exist**:
  - Bold, italic, underline
  - Per‑heading level (H1–H6)
  - Unique text colors
  - Alignment changes
- No assumptions: if a format doesn’t appear in your text, it doesn’t appear in the “Detected formatting” list.

### User‑defined semantic tags

For each detected format, you can provide a **semantic tag name**:

- Example mappings:
  - Bold → `Question`
  - Red text → `Answer`
  - Centered H2 → `Heading`
  - Specific color → `Time`
- These tags are then applied wherever that exact formatting appears.

### Precise, nested tagging logic

- Walks the DOM in order and maintains a global **tag stack**.
- For each text node:
  - Computes which tags apply (based on local style and ancestors).
  - Opens new tags only when formatting starts.
  - Closes tags only when formatting ends.
  - Preserves original text, spaces and line breaks **exactly**.
- Supports nested cases like:

```text
<imp><heading>Time is Running Out to Secure Your Place Among AI's Elite</heading></imp>
<question>Hi Safak,
Thank you for booking the blood test…</question>
<answer><time>11th February at 2:00 pm.</time>
Could you please also let us know how long would be the nurse consultation process?
Regards,</answer>
```

### Dual output: plain tags + visual preview

- **Plain tagged text**:
  - Monospace, copy‑friendly view of the final string you’ll send to ChatGPT, Claude, Gemini, etc.
  - Exactly matches your input content plus tags.
- **Visual preview**:
  - Shows your text with tags rendered as small highlighted chips (e.g. `<Question>`, `</Answer>`).
  - Makes it easy to verify where tags start and end without reading raw markup.

### Feedback collection (optional)

- Inline **Like / Dislike / Question** controls next to the “Copy output” button.
- Lightweight modal asks for an **optional email** so you can follow up.
- Feedback events can be stored in:
  - **Firebase Firestore** (preferred in this repo).
  - Or a custom backend, if you swap out the `sendFeedback` implementation.

---

## Getting started

### Prerequisites

- Node.js is *not* required; this is a static HTML/CSS/JS app.
- Any static host will work (GitHub Pages, Netlify, Vercel, Firebase Hosting, S3, etc.).

### Run locally

From the project root:

```bash
cd Formantics
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
```

Paste some formatted text into the **Input** panel, click **Parse formatting**, assign meanings for each format under **Detected formatting**, and click **Generate text**.

---

## Optional: Firebase setup for feedback

Formantics ships with an optional Firebase integration to collect feedback events.

### 1. Create Firebase project & Firestore

1. Go to `https://console.firebase.google.com` and create a new project, e.g. `formantics-feedback`.
2. Under **Build → Firestore Database**, create a Firestore instance (test mode is fine for early experiments).

### 2. Create a Web app and copy the config

1. In Firebase console, under your project, click the **web `</>` icon** to add a Web app.
2. After registering, copy the config object (the one with `apiKey`, `authDomain`, `projectId`, etc.).

### 3. Paste the config into `index.html`

In `index.html` near the bottom you’ll see:

```html
<script>
  // TODO: Replace this object with your Firebase web app config
  // from Firebase console → Project settings → Your apps → Web app → Config.
  window.FORMANTICS_FIREBASE_CONFIG = {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_AUTH_DOMAIN",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_STORAGE_BUCKET",
    // messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    // appId: "YOUR_APP_ID"
  };

  if (
    window.FORMANTICS_FIREBASE_CONFIG &&
    window.FORMANTICS_FIREBASE_CONFIG.projectId
  ) {
    firebase.initializeApp(window.FORMANTICS_FIREBASE_CONFIG);
    window._formanticsDb = firebase.firestore();
  }
</script>
```

Replace the commented values with your real Firebase config.

### 4. Where feedback is stored

When a user clicks **Like**, **Dislike**, or **Question** and confirms/skips email:

- `app.js` calls `sendFeedback(kind, email)`, which writes a document into the `feedbackEvents` collection with:

```json
{
  "type": "like | dislike | question",
  "email": "optional@example.com",
  "timestamp": "2026-02-10T12:34:56.789Z",
  "userAgent": "Mozilla/5.0 ..."
}
```

You can inspect these under **Firestore → Collections → feedbackEvents**.

If Firebase isn’t configured, payloads are just logged to the browser console and a “Thanks for your feedback.” message is still shown to the user.

---

## SEO & metadata overview

Formantics is designed to be easy to discover as **“formatting to semantics for AI”**:

- Primary keywords:
  - “convert formatting to AI tags”
  - “semantic tagging for ChatGPT prompts”
  - “rich text to AI‑ready tags”
  - “preserve formatting in AI prompts”
- `index.html` includes:
  - Descriptive `<title>` and `<meta name="description">`.
  - Open Graph and Twitter Card tags for richer link previews (see below).

When deploying publicly, you can also:

- Host under a clear path such as `https://yourdomain.com/formantics/`.
- Configure a canonical URL in `index.html` (see below).

---

## Open Graph & social previews

`index.html` includes SEO‑friendly metadata in the `<head>` (you can adjust the URL/image as needed when you deploy):

```html
<title>Formantics – Convert Formatting into AI‑Ready Semantic Tags</title>
<meta
  name="description"
  content="Formantics converts rich text formatting into explicit semantic tags that AI models understand. Paste from Word, Google Docs, or PDFs and generate AI‑ready tagged prompts without losing intent."
/>
<link rel="canonical" href="https://your-domain.com/formantics/" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:title" content="Formantics – Formatting to Semantics for AI" />
<meta
  property="og:description"
  content="Preserve bold, color, and headings as semantic tags for ChatGPT, Claude, and Gemini. Formantics turns your visual formatting into AI‑ready markup."
/>
<meta property="og:url" content="https://your-domain.com/formantics/" />
<meta property="og:image" content="https://your-domain.com/formantics/og-image.png" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Formantics – Formatting to Semantics for AI" />
<meta
  name="twitter:description"
  content="Convert rich text formatting into explicit semantic tags that AI can understand."
/>
<meta name="twitter:image" content="https://your-domain.com/formantics/og-image.png" />
```

Update the canonical URL and `og:image` / `twitter:image` to match your deployment.

---

## Tech stack

- **Frontend**: Vanilla HTML, CSS, and JavaScript (no framework).
- **Editor**: `contenteditable` div with DOM‑based formatting detection.
- **Parsing**: DOM traversal with `TreeWalker`, computed styles, and a global tag stack.
- **Feedback storage**: Optional Firebase Firestore (`firebase-app-compat` + `firebase-firestore-compat`).

---

## Roadmap ideas

- Multiple tag priorities (e.g. bold > color when conflicts arise).
- Inline highlighting of segments that will be tagged.
- Support for:
  - Word uploads (`.docx` → HTML).
  - PDF upload (via PDF‑to‑HTML extraction).
  - Direct Google Docs import.
- AI‑assisted suggestions:
  - “This looks like a question – tag as `<Question>`?”
- Exportable templates for common prompt patterns.

If you’d like to contribute or share feedback, use the **Like / Dislike / Question** buttons in the app or open an issue on GitHub. 
