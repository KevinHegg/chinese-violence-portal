# Website Review & Recommendations
## John Crow Archive - Comprehensive Code Review

**Review Date:** January 19, 2026  
**Website:** https://johncrow.org/

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. **Security: Exposed API Keys**
**Location:** `public/map.html` (lines 201, 205)  
**Issue:** Mapbox API token is hardcoded and publicly visible  
**Risk:** Token can be stolen and abused, leading to unexpected charges  
**Fix:** 
- Move token to environment variable
- Use Netlify environment variables or server-side rendering
- Consider using Mapbox domain restrictions

### 2. **Security: Sensitive Data in Console Logs**
**Location:** Multiple files (53 console.log statements found)  
**Issue:** Console logs expose API keys, request bodies, and sensitive data  
**Risk:** Data leakage in production  
**Fix:**
- Remove all production console.log statements
- Use proper logging service (e.g., Sentry) for errors only
- Wrap console calls in `if (import.meta.env.DEV)`

### 3. **Performance: Large JSON Files Loaded Client-Side** ✅ RESOLVED
**Location:** `src/data/lynchings.json` (3,745 lines), `src/data/articles.json`  
**Issue:** Entire datasets loaded on every page load  
**Risk:** Slow initial page load, poor mobile performance  
**Fix:** ✅ **IMPLEMENTED** - Now using Google Sheets API with server-side caching (5-minute cache), SSR for data-heavy pages, and the old JSON files have been removed from the codebase.

### 4. **Performance: No Image Optimization**
**Location:** Article scans, background images  
**Issue:** Images loaded without optimization (91KB-303KB per image)  
**Risk:** Slow page loads, high bandwidth usage  
**Fix:**
- Implement Astro Image component with responsive images
- Add lazy loading for below-fold images
- Convert to WebP format with fallbacks
- Use srcset for responsive images
- Consider CDN for image delivery

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **SEO: Missing Open Graph & Twitter Cards**
**Location:** `src/layouts/PageLayout.astro`  
**Issue:** No social media preview tags  
**Impact:** Poor sharing experience on social platforms  
**Fix:**
```astro
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={ogImage} />
<meta property="og:url" content={canonicalUrl} />
<meta name="twitter:card" content="summary_large_image" />
```

### 6. **SEO: Missing Structured Data (JSON-LD)**
**Location:** All pages  
**Issue:** No schema.org markup for better search visibility  
**Fix:** Add JSON-LD for:
- Organization schema
- Article schema for news articles
- Dataset schema for the dataset page
- BreadcrumbList schema

### 7. **Performance: External Scripts Blocking Render**
**Location:** `src/pages/dataset.astro` (lines 90-92)  
**Issue:** html2pdf.js and xlsx.js loaded synchronously from CDN  
**Fix:**
- Use `defer` or `async` attributes
- Consider bundling with build process
- Load only when needed (on button click)

### 8. **Performance: Inefficient CSV Parsing**
**Location:** `src/pages/dataset.astro` (lines 111-131)  
**Issue:** Manual CSV parsing with string splitting (doesn't handle quoted fields properly)  
**Fix:**
- Use proper CSV parser library (already have csv-parse in dependencies)
- Parse on server-side and send JSON
- Add error handling for malformed CSV

### 9. **API: No Rate Limiting**
**Location:** `src/pages/api/chat.ts`  
**Issue:** Chat API has no rate limiting  
**Risk:** Abuse, high costs, DoS vulnerability  
**Fix:**
- Implement rate limiting (e.g., 10 requests per minute per IP)
- Add request timeout handling
- Consider using Netlify Edge Functions for rate limiting

### 10. **API: Polling Inefficiency**
**Location:** `src/pages/api/chat.ts` (lines 112-132)  
**Issue:** Polling every 1 second with no exponential backoff  
**Risk:** Unnecessary API calls, slower response times  
**Fix:**
- Implement exponential backoff
- Use WebSockets or Server-Sent Events if possible
- Add maximum polling duration

---

## 🟢 MEDIUM PRIORITY ISSUES

### 11. **Accessibility: Missing Skip Links**
**Location:** All pages  
**Issue:** No "skip to main content" link  
**Fix:** Add skip link at top of page

### 12. **Accessibility: Missing Alt Text**
**Location:** Some images (e.g., background images)  
**Issue:** Decorative images should have empty alt=""  
**Fix:** Review all images and add appropriate alt text

### 13. **Code Quality: Excessive Console Logs**
**Location:** 53 console.log statements across 15 files  
**Issue:** Debug code left in production  
**Fix:**
- Remove or wrap in dev-only checks
- Use proper logging library

### 14. **Performance: Background Image on Every Page**
**Location:** `src/styles/tailwind.css` (lines 13-27)  
**Issue:** Large background image loaded on every page  
**Fix:**
- Optimize image (compress, WebP)
- Consider lazy loading or CSS-only pattern
- Use smaller image or remove if not critical

### 15. **SEO: Missing Canonical URLs**
**Location:** All pages  
**Issue:** No canonical tags to prevent duplicate content  
**Fix:** Add canonical URL to each page

### 16. **SEO: Missing Sitemap**
**Location:** Root  
**Issue:** No sitemap.xml for search engines  
**Fix:** Generate sitemap using Astro sitemap integration

### 17. **Performance: No Code Splitting**
**Location:** Build configuration  
**Issue:** All JavaScript loaded upfront  
**Fix:**
- Enable code splitting in Astro config
- Use dynamic imports for heavy components
- Lazy load visualization libraries

### 18. **Security: No Input Sanitization**
**Location:** `src/pages/api/chat.ts`  
**Issue:** User input not sanitized before sending to OpenAI  
**Risk:** Potential injection attacks  
**Fix:** Sanitize and validate user input

### 19. **Performance: Large Bundle Sizes**
**Location:** External libraries (html2pdf, xlsx, marked)  
**Issue:** Large libraries loaded even when not used  
**Fix:**
- Use dynamic imports
- Consider lighter alternatives
- Tree-shake unused code

### 20. **Code Quality: Inconsistent Error Handling**
**Location:** Multiple files  
**Issue:** Some errors caught, others not  
**Fix:** Standardize error handling pattern

---

## 🔵 LOW PRIORITY / NICE TO HAVE

### 21. **Accessibility: Keyboard Navigation**
**Location:** Interactive components  
**Issue:** Some components may not be fully keyboard accessible  
**Fix:** Test and improve keyboard navigation

### 22. **Performance: Add Service Worker**
**Location:** Root  
**Issue:** No offline support  
**Fix:** Add service worker for PWA capabilities

### 23. **SEO: Add robots.txt**
**Location:** `public/robots.txt`  
**Issue:** No robots.txt file  
**Fix:** Create robots.txt with sitemap reference

### 24. **Security: Add CSP Headers**
**Location:** Netlify configuration  
**Issue:** No Content Security Policy  
**Fix:** Add CSP headers via Netlify headers

### 25. **Performance: Add Resource Hints**
**Location:** `PageLayout.astro`  
**Issue:** No preload/prefetch for critical resources  
**Fix:** Add preload for fonts, prefetch for likely next pages

### 26. **Code Quality: TypeScript Strict Mode**
**Location:** `tsconfig.json`  
**Issue:** TypeScript not in strict mode  
**Fix:** Enable strict mode for better type safety

### 27. **Performance: Database Instead of JSON**
**Location:** Data storage  
**Issue:** Large JSON files in repo  
**Fix:** Consider moving to database (e.g., Supabase, PlanetScale)

### 28. **Accessibility: Color Contrast**
**Location:** Styles  
**Issue:** Verify all text meets WCAG AA contrast ratios  
**Fix:** Audit and fix contrast issues

### 29. **Performance: Add Compression**
**Location:** Netlify configuration  
**Issue:** Ensure gzip/brotli compression enabled  
**Fix:** Verify Netlify compression settings

### 30. **Code Quality: Remove Duplicate Code**
**Location:** Multiple files  
**Issue:** Some code patterns repeated  
**Fix:** Extract to shared utilities/components

---

## 📊 SUMMARY

**Total Issues Found:** 30  
**Critical:** 4  
**High Priority:** 6  
**Medium Priority:** 10  
**Low Priority:** 10

**Estimated Impact:**
- **Security:** 3 critical issues need immediate attention
- **Performance:** Significant improvements possible (especially images and data loading)
- **SEO:** Missing key elements but easy to add
- **Accessibility:** Generally good, minor improvements needed
- **Code Quality:** Good structure, needs cleanup of debug code

**Recommended Action Plan:**
1. Fix security issues immediately (API keys, console logs)
2. Optimize images and data loading (biggest performance wins)
3. Add SEO meta tags and structured data
4. Clean up console logs and improve error handling
5. Add rate limiting and input sanitization to API

---

## 🛠️ QUICK WINS (Can be done in < 1 hour each)

1. Remove console.log statements
2. Add Open Graph tags
3. Add canonical URLs
4. Add robots.txt
5. Optimize background image
6. Add skip link
7. Add sitemap
8. Move Mapbox token to env var

---

## 📈 EXPECTED IMPROVEMENTS

After implementing recommendations:
- **Performance:** 40-60% faster page loads
- **SEO:** Better search rankings and social sharing
- **Security:** Reduced risk of API abuse and data leakage
- **Accessibility:** WCAG AA compliance
- **User Experience:** Faster, more reliable, better mobile experience
