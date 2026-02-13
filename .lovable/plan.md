

# Fix Blank Preview -- Remove GitHub Pages Base Path Conflict

## Problem
The Lovite config has `base: '/cheese.null/'` which is needed for GitHub Pages but breaks the Lovable preview. The preview server returns a 502 error because it can't find files at `/cheese.null/src/main.tsx`.

## Solution
Make the `base` path conditional so it only applies during production builds (for GitHub Pages) but not during development (for Lovable preview).

## Change

### File: `vite.config.ts`

Update the `base` property to only apply in production:

```typescript
base: mode === 'production' ? '/cheese.null/' : '/',
```

This way:
- **Lovable preview** (development mode): serves from `/` -- works correctly
- **GitHub Pages build** (production mode): serves from `/cheese.null/` -- works correctly

No other files need to change.

