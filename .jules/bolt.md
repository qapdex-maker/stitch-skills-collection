# Bolt's Journal

## 2026-03-05 - [Caching realpath resolution and avoiding try-catch overhead in path traversal checks]
**Learning:** During path safety validation, resolving physical paths via `fs.realpathSync` for files that do not exist results in slow synchronous exceptions. By checking `fs.existsSync` first and caching the canonical paths in a local `Map`, we completely eliminate disk access bottleneck and exception overhead for duplicate and non-existent assets.
**Action:** Always cache synchronous filesystem validation results and avoid relying on try-catch blocks for control flow of common non-existent path lookups.

## 2026-03-05 - [Caching file system reads and resolution during static HTML extraction]
**Learning:** During static HTML extraction and post-processing, inlining local images and CSS url() assets reads from and queries the filesystem repeatedly. By adding scoped, execution-local caches inside `inlineImages`, we avoid redundant IO and stats queries for duplicate assets.
**Action:** Use local Map-based caches scoped to functions performing file reads or network requests to handle duplicate references efficiently.

## 2026-03-05 - [Parallel Batch Prefetching & Promise Coalescing in Remote Image Extraction]
**Learning:** When embedding remote images and assets during static HTML extraction, serial/sequential prefetching phases (e.g. images first, then CSS, then posters) introduce significant head-of-line blocking. Furthermore, concurrent duplicate assets can cause duplicate simultaneous requests without coalescing.
**Action:** Extract all unique remote asset URLs upfront into a single Set, fetch them concurrently in a flat parallel batch, and use an active fetch Promise cache to coalescing duplicate requests. Re-extract indices dynamically during the replacement phases to prevent character-index shift document corruption.
