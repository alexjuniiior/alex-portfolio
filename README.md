# alexlisovski.com

Alex Lisovski's portfolio: a static site with scroll animations (GSAP, ScrollTrigger, SplitText, Lenis).
Everything Netlify serves lives in `public/`; there is no build step.

- `public/index.html` - page structure and copy
- `public/css/styles.css` - styles (desktop, tablet 761-1279px, phone up to 760px)
- `public/js/main.js` - all animations and interactions
- `public/images`, `public/videos`, `public/assets` - media

Run locally: `cd public && python3 -m http.server 8000`, then open http://localhost:8000

The previous version of the site (with the Pages CMS editor) is kept on the git branch `v1-site`.
