# Oh My Shine! — development instructions

- Project is currently a **static Vite multi-page storefront**, not Astro or WordPress.
- Preserve existing HTML, CSS layers, @scope styles, and current JavaScript modules unless a change is required.
- CSS uses PostCSS plugins already configured in package.json. Do not replace it with SCSS or Tailwind without an explicit request.
- Root `index.html` is the home page. CSS entry: `src/styles/main.css`. JS entry: `src/js/main.js`.
- New pages should have clean paths via `<route>/index.html`; add explicit Vite build entries when implementing them.
- Inquiry forms currently target `POST /api/request`; the backend is not implemented and must not be represented as working.
- Do not put API credentials or other secrets in browser code.
- Future WooCommerce migration: preserve CSS/JS and product slugs, adapt templates and order flow to WordPress rather than inventing a separate cart.
- Run `pnpm lint` and `pnpm build` after changes; report results honestly.
