# Angular 12 Compatibility Guide

## Overview

This data grid component is **compatible with Angular 12** with some minor adjustments. The codebase uses traditional NgModule-based architecture, which is fully supported in Angular 12.

## Compatibility Status

✅ **Compatible Features:**
- NgModule-based architecture
- Traditional component structure
- RxJS Observables (compatible versions)
- FormsModule and CommonModule
- RouterModule
- All core functionality (sorting, filtering, grouping, etc.)

⚠️ **Required Changes:**
- Dependency versions need to be downgraded
- TypeScript version needs to be adjusted
- Some TypeScript compiler options may need adjustment

## Migration Steps

### 1. Update package.json

Replace the dependencies section with Angular 12 compatible versions:

```json
{
  "dependencies": {
    "@angular/animations": "^12.2.0",
    "@angular/common": "^12.2.0",
    "@angular/compiler": "^12.2.0",
    "@angular/core": "^12.2.0",
    "@angular/forms": "^12.2.0",
    "@angular/platform-browser": "^12.2.0",
    "@angular/platform-browser-dynamic": "^12.2.0",
    "@angular/router": "^12.2.0",
    "lodash-es": "^4.17.21",
    "rxjs": "^6.6.7",
    "tslib": "^2.3.1",
    "zone.js": "~0.11.4"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^12.2.0",
    "@angular/cli": "^12.2.0",
    "@angular/compiler-cli": "^12.2.0",
    "@angular/language-service": "^12.2.0",
    "@types/jasmine": "~3.8.0",
    "@types/node": "^12.20.0",
    "ng-packagr": "^12.2.0",
    "typescript": "~4.3.5"
  },
  "peerDependencies": {
    "@angular/common": "^12.0.0",
    "@angular/core": "^12.0.0",
    "@angular/forms": "^12.0.0",
    "rxjs": "^6.6.0"
  }
}
```

### 2. Update tsconfig.json

Adjust TypeScript compiler options for Angular 12:

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ES2020",
    "lib": ["ES2018", "dom"],
    // ... other options remain the same
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### 3. Update angular.json

Ensure the builder versions are compatible:

```json
{
  "projects": {
    "ng-data-grid": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:ng-packagr"
        }
      }
    }
  }
}
```

### 4. Code Compatibility

The codebase is already compatible! No code changes needed because:

- ✅ Uses NgModule (not standalone components)
- ✅ Uses traditional template syntax (not @if/@for)
- ✅ Uses standard Angular APIs
- ✅ No Angular 17-specific features

### 5. RxJS Compatibility

Angular 12 uses RxJS 6.x. The code uses standard RxJS operators that are compatible:

- `BehaviorSubject` ✅
- `Observable` ✅
- `combineLatest` ✅
- `debounceTime` ✅
- `switchMap` ✅
- `map` ✅
- `startWith` ✅
- `of` ✅
- `delay` ✅
- `takeUntil` ✅

All operators are available in RxJS 6.x.

### 6. Installation

After updating package.json:

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install Angular 12 compatible dependencies
npm install

# Build the library
npm run build

# Run the demo
npm start
```

## Version Compatibility Matrix

| Component | Angular 17 (Current) | Angular 12 (Compatible) |
|-----------|---------------------|----------------------|
| Angular Core | ^17.0.0 | ^12.2.0 |
| TypeScript | ~5.2.2 | ~4.3.5 |
| RxJS | ^7.8.1 | ^6.6.7 |
| Zone.js | ^0.14.2 | ~0.11.4 |
| ng-packagr | ^17.3.0 | ^12.2.0 |

## Testing

After migration, test the following features:

1. ✅ Grid renders correctly
2. ✅ Sorting works
3. ✅ Filtering works
4. ✅ Grouping works
5. ✅ Pagination works
6. ✅ Virtual scrolling works
7. ✅ Column resizing works
8. ✅ Column reordering works
9. ✅ Cell editing works
10. ✅ Export functions work

## Known Limitations

None! The component is fully compatible with Angular 12.

## Support

If you encounter any issues during migration:

1. Check Angular 12 migration guide: https://angular.io/guide/updating-to-version-12
2. Verify all dependencies are correctly installed
3. Clear node_modules and reinstall
4. Check TypeScript version compatibility

## Quick Start for Angular 12

1. Copy `package.json.angular12` to `package.json`
2. Run `npm install`
3. Run `npm run build`
4. Run `npm start`

The component will work exactly the same way!

