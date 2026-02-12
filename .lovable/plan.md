
## Auto-Deploy to GitHub Pages via GitHub Actions

**Repository**: `cheese.null` on https://github.com/cheesenull32/cheese.null

### Overview
This setup will automatically build and deploy your frontend to GitHub Pages every time you push changes from Lovable. Your site will be available at `https://cheesenull32.github.io/cheese.null/`

### Changes Required

#### 1. Create GitHub Actions Workflow File
**New file: `.github/workflows/deploy.yml`**

A GitHub Actions workflow that will:
- Trigger automatically on every push to the `main` branch
- Install dependencies with `npm ci`
- Build the project with `npm run build`
- Deploy the resulting `dist` folder to GitHub Pages
- Copy `index.html` to `404.html` for proper SPA routing support

#### 2. Update Vite Configuration
**Modify: `vite.config.ts`**

Add `base: '/cheese.null/'` to the Vite config. This ensures all CSS, JavaScript, and image assets load from the correct path when served from GitHub Pages subdirectory.

Changes:
- Add `base: '/cheese.null/',` as a property in the config object (after the `server` configuration)
- This tells Vite to prepend `/cheese.null/` to all asset paths during the build

### After Approval Steps
1. I'll create the workflow file and update vite.config.ts
2. Go to your GitHub repository Settings > Pages
3. Set Source to "GitHub Actions"
4. Done! Every Lovable change auto-deploys to GitHub Pages within 1-2 minutes

### Technical Details
- The workflow uses `actions/checkout@v4` and `actions/deploy-pages@v4` (GitHub's official actions for page deployment)
- `npm ci` is used instead of `npm install` for cleaner, more reliable builds
- The 404.html fallback handles client-side routing for your single-page app
- No secrets or additional configuration needed—GitHub Actions handles everything automatically
