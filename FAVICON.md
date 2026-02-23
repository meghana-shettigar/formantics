# Favicon and Google Search Results

## Current setup

All pages use **`/assets/logo.png`** as the favicon so your logo appears in browser tabs and (after Google re-crawls) in search results. The previous link pointed to `/favicon.png`, which was not in the project, so Google showed a generic icon.

## After you deploy

1. **Redeploy** so the updated `<link rel="icon">` tags are live.
2. **Check the URL**  
   Open:  
   `https://www.google.com/s2/favicons?sz=64&domain=www.retainformat.com`  
   After Google has re-crawled your site, it should show your logo (this can take days or weeks).
3. **Optional – ask Google to recrawl**  
   In [Google Search Console](https://search.google.com/search-console) → URL Inspection → enter `https://www.retainformat.com/` → **Request indexing**.

## Optional: dedicated square favicon (better in search)

Google recommends a **square** image, ideally **48×48 px** (or 96×96), so the icon is not cropped.

- Create a **48×48** (or 96×96) PNG of your logo or brand mark and save it as **`favicon.png`** in the **root** of the site (same folder as `index.html`).
- Then change the favicon links in `index.html` (and blog pages) back to:
  - `https://www.retainformat.com/favicon.png`
- Ensure `favicon.png` is deployed at the root so that URL is reachable.

Until then, using `/assets/logo.png` is fine and will show your logo instead of a generic icon.
