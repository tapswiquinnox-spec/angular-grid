# Node.js Version Compatibility Fix

## Problem
Angular 12 uses webpack 4, which requires the legacy OpenSSL MD4 hash algorithm. Node.js 17+ removed support for this, causing the error:
```
Error: error:0308010C:digital envelope routines::unsupported
```

## Solutions

### Option 1: Use Node.js 16 (Recommended)
The best solution is to use Node.js 16, which is fully compatible with Angular 12:

1. Install Node.js 16 LTS from https://nodejs.org/
2. Or use a version manager:
   - **nvm (Windows)**: `nvm install 16 && nvm use 16`
   - **nvm (Mac/Linux)**: `nvm install 16 && nvm use 16`

### Option 2: Use Legacy OpenSSL Provider (Quick Fix)
The package.json scripts have been updated to use `NODE_OPTIONS=--openssl-legacy-provider`.

**For Windows (cmd.exe):**
```bash
npm start
```

**For Windows (PowerShell):**
```powershell
$env:NODE_OPTIONS="--openssl-legacy-provider"; npm start
```

**For Mac/Linux:**
```bash
NODE_OPTIONS=--openssl-legacy-provider npm start
```

### Option 3: Install cross-env (Cross-platform)
For a more robust cross-platform solution:

```bash
npm install --save-dev cross-env
```

Then update package.json scripts to use:
```json
"start": "cross-env NODE_OPTIONS=--openssl-legacy-provider ng serve grid-demo"
```

## Current Node.js Version
You are currently using: **Node.js v22.16.0**

Angular 12 officially supports: **Node.js 12.x, 14.x, 16.x**

## Recommendation
For best compatibility with Angular 12, use **Node.js 16 LTS**.

