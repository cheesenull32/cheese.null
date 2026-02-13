

# Fix React Router 404 on GitHub Pages

## Problem
The app deploys to `https://cheesenull32.github.io/cheese.null/`, so the browser URL path is `/cheese.null/`. But React Router's `BrowserRouter` expects routes relative to `/`, so it doesn't match `/cheese.null/` to the `"/"` route and shows the 404 page.

## Solution
Set the `basename` prop on `BrowserRouter` to `/cheese.null` in production, so React Router correctly matches routes under that subpath.

## Change

### File: `src/App.tsx`

Update `BrowserRouter` to include a conditional `basename`:

```text
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

Vite automatically sets `import.meta.env.BASE_URL` to match the `base` value in `vite.config.ts`:
- Development: `"/"`
- Production: `"/cheese.null/"`

This means no hardcoding is needed -- it stays in sync with the Vite config automatically.

No other files need to change.

