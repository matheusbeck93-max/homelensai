## Goal
Add the provided GA4 tracking snippet to `index.html` so it loads on every page of the single-page app.

## Snippet to add
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3N9EVXFJH7"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-3N9EVXFJH7');
</script>
```

## Plan
1. Open `index.html`.
2. Insert the snippet inside `<head>`, after the existing `<meta>` tags and before the closing `</head>`.
3. Verify the file still has valid HTML structure.

That's it — one file, no dependencies.