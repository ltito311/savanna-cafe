# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Savanna Cafe is a static multi-page HTML ordering app for a cafe. There is no build system, no JavaScript framework, and no package manager — all pages are plain HTML files with Tailwind CSS loaded via CDN.

## Development

No build step is needed. Open files directly in a browser or use any static file server:

```bash
# Serve locally with Python
python3 -m http.server 8080 --directory docs

# Or with Node's npx
npx serve docs
```

The `docs/` directory is the web root (structured for GitHub Pages deployment from the `docs/` folder).

## Architecture

### Page Flow

```
index.html  →  menu.html  →  cart.html
(home/landing)  (full menu)  (order/checkout)
```

- `index.html` — landing page with featured dishes carousel and a "View Menu" CTA button
- `menu.html` — scrollable featured section + full menu list with "Add" buttons; has a bottom nav bar (Home / Menu / Cart / Loyalty tabs)
- `cart.html` — order review with quantity controls, order summary, promo code input, pickup time selector, and WhatsApp/SMS share buttons

Navigation uses plain `<a href>` links. Back arrows link to the previous page. The bottom nav in `menu.html` links to `cart.html`.

### Styling

Tailwind CSS is loaded from CDN (`https://cdn.tailwindcss.com?plugins=forms,container-queries`). Custom design tokens are declared in a `<style type="text/tailwindcss">` block in each page's `<head>` using CSS variables:

| Token | Value | Usage |
|---|---|---|
| `--green` | `#4CAF50` | Primary action color (buttons, active states) |
| `--wood-brown` | `#8B5E3C` | Brand color (headings, prices, back arrows) |
| `--white` | `#FFFFFF` | Backgrounds |

Each page defines its own Tailwind utility aliases from these variables (e.g., `.bg-green`, `.text-wood-brown`, `.text-wood`). **Note:** the aliases differ slightly between pages — `index.html` and `menu.html` use `.text-wood-brown`/`.bg-wood-brown`, while `cart.html` uses `.text-wood`/`.bg-wood`/`.border-wood`. Keep this inconsistency in mind when adding classes; always check which page you're editing.

### Icons

All icons are inline SVG using the [Phosphor Icons](https://phosphoricons.com/) set (256×256 viewBox, `fill="currentColor"`).

### Images

Product images are served from `lh3.googleusercontent.com` (Google's AIDA public CDN). Background images use inline `style='background-image: url(...)'` on container `<div>`s; product images in list rows use `<img>` tags.

### Fonts

"Spline Sans" (headings/body) and "Noto Sans" (fallback) loaded from Google Fonts via `<link>` with the `onload` lazy-load pattern.

## Known Issues

- `menu.html` has `<title>Stitch Design</title>` instead of "Savanna Cafe" — this is a leftover from the design tool export.
- All interactive buttons (Add to cart, quantity +/−, Apply promo, Confirm Order) are static HTML with no JavaScript wired up.
