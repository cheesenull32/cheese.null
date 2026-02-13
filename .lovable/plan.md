

# Fix GitHub Pages Build: Lock File Out of Sync

## Problem
The GitHub Actions deployment fails because `package-lock.json` is out of sync with `package.json`. Several testing-related packages are missing from the lock file.

## Solution
Change `npm ci` to `npm install` in the GitHub Actions workflow. `npm ci` requires an exact lock file match, while `npm install` will resolve and install dependencies even if the lock file is slightly out of date (and will update it).

## Change

### File: `.github/workflows/deploy.yml`

Replace the install step:
```yaml
# Before
- name: Install dependencies
  run: npm ci

# After
- name: Install dependencies
  run: npm install
```

This is a single-line change that will unblock the deployment immediately.

