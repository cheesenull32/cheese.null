

# Fix Social Media Link Preview

## Problem
When sharing `https://cheesenull32.github.io/cheese.null/`, the link preview shows Lovable branding because `index.html` still has Lovable's default Open Graph meta tags and title.

## Solution
Update the meta tags in `index.html` to reflect the CheeseNull project instead of Lovable defaults.

## Change

### File: `index.html`

Update these meta tags:

- `<title>` -- change from "Lovable App" to "CheeseNull"
- `<meta name="description">` -- update to describe CheeseNull
- `<meta name="author">` -- change from "Lovable" to "CheeseNull"
- `<meta property="og:title">` -- change to "CheeseNull"
- `<meta property="og:description">` -- update description
- `<meta property="og:image">` -- remove or replace the Lovable OpenGraph image URL
- `<meta name="twitter:site">` -- remove the `@Lovable` reference
- `<meta name="twitter:image">` -- remove or replace the Lovable image URL

This is a single-file change with no code logic involved -- just updating static HTML meta content.

