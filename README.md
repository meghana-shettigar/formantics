# RetainFormat – Formatting to Semantics for AI

RetainFormat is a web app that **converts visual formatting into explicit semantic tags that AI models can understand**. Paste rich text from Word, Google Docs, PDFs, email, or the web and RetainFormat preserves your formatting, lets you assign semantic meanings, and generates **AI‑ready tagged text** without changing the original order.

## What RetainFormat does

Most AI prompts lose visual intent when formatting is stripped. RetainFormat treats formatting as data and converts it into clear semantic tags:

- **Bold, italic, underline** → user-defined tags
- **Text colors** → semantic meanings (e.g. red = Answer, green = Example)
- **Headings (H1–H6)** → structural tags
- **Alignment** → contextual tags

Example output:

```text
<Question>What is your opinion?</Question>
<Answer>I think that is a valuable item.</Answer>
```

## Key features

- **Rich text input**: Paste from Word, Google Docs, PDFs, email, websites with full formatting preserved
- **Automatic detection**: Only shows formats that actually exist in your text
- **User-defined tags**: Assign semantic meanings to each format (e.g. Bold → `Question`, Red → `Answer`)
- **Precise tagging**: Maintains original text order and applies tags exactly where formatting appears
- **Dual output**: Plain tagged text for copying + visual preview with highlighted tags

## Try it

Visit **[https://www.retainformat.com/](https://www.retainformat.com/)** to use RetainFormat.

## Repository

Source code: **[https://github.com/meghana-shettigar/formantics](https://github.com/meghana-shettigar/formantics)**

## Feedback

Use the **Like / Dislike / Question** buttons in the app to share feedback, or open an issue on GitHub.
