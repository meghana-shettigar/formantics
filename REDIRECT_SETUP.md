# Fix "Page with redirect" in Google Search Console

Google is not indexing these URLs because they **redirect** to your canonical site:

- `http://retainformat.com/`
- `http://www.retainformat.com/`
- `https://retainformat.com/`

Your canonical site is **`https://www.retainformat.com/`**. That is correct. The message means: Google found those other URLs and, when it follows them, it gets a redirect to `https://www.retainformat.com/`. So Google indexes the **destination** (www), not the redirecting URL. Your main site is fine.

To **clear the warning** and have a single, clean setup, make sure all three URLs above **permanently (301) redirect** to `https://www.retainformat.com/`. That is done at **hosting/DNS**, not in this repo.

## If you use GitHub Pages

1. **Repo → Settings → Pages**
2. Under **Custom domain**, you should have: `www.retainformat.com`
3. **Enforce HTTPS** should be checked (so `http://www` → `https://www`).
4. For the **apex** domain (`retainformat.com` without www):
   - In the same **Custom domain** section, add: `retainformat.com`
   - GitHub will then redirect `retainformat.com` → `www.retainformat.com` (and HTTPS).
5. In your **DNS** (where you bought the domain):
   - **A/ALIAS for apex:** point `retainformat.com` to GitHub Pages (e.g. `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) **or** use your host’s “redirect apex to www” if they offer it.
   - **CNAME for www:** `www` → `username.github.io` (or your Pages URL).

Exact DNS records depend on your registrar (e.g. Namecheap, GoDaddy, Cloudflare). Search for “GitHub Pages custom domain apex redirect” for your provider.

## After redirects are in place

- In **Google Search Console**, use **URL Inspection** for `https://www.retainformat.com/` and request indexing if needed.
- The “Page with redirect” lines in the report are expected for the old URLs; what matters is that `https://www.retainformat.com/` is indexed and that redirects are 301 to that URL.
