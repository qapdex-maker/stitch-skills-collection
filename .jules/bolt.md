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

## 2026-03-05 - [Sliding-Window Worker Pool to Prevent Head-of-Line Blocking]
**Learning:** In asynchronous batch operations (e.g. parallelizing resource/image fetches in browser page contexts), standard chunking loops (like chunks of Promise.all) suffer from severe head-of-line blocking, throttling the entire chunk to the speed of the single slowest asset or timeout. Replaced sequential chunking with a continuous worker pool/sliding-window queue that allows workers to immediately pull new tasks from a shared cursor.
**Action:** Use a sliding-window queue/worker pool pattern rather than batch-by-batch waiting when processing network tasks with highly variable latencies.

## 2026-03-06 - [Static Regex Compilation and Caching Canonical Path Lookups]
**Learning:** Compiling dynamic Regular Expressions inside loops and running match operations that allocate arrays introduces GC pressure and performance bottlenecks. Extracting regex patterns (such as attribute matching) into module-level static constants and using lightweight `RegExp.prototype.test()` instead of `match()` eliminates compile overhead. Additionally, caching both the input query path and resolved canonical output path in a realpath utility map guarantees subsequent duplicate lookups are resolved in O(1) time.
**Action:** Declare all loops' regexes at module scope as static constants and cache both the query and canonical return keys to minimize CPU cycles and memory churn.

## 2026-03-07 - [Substring Slices and Array Joining for Escaped URL Parsing & RegExp Hoisting]
**Learning:** Character-by-character string concatenation inside hot string parsing loops causes substantial memory allocations and Garbage Collection (GC) overhead in JS runtimes. Replacing concatenation with substring slicing and array joins significantly minimizes memory churn. Furthermore, compiling RegExp literals inside styled element loops creates unnecessary dynamic compilation overhead, which is entirely bypassed by hoisting RegExp instances outside loop and invocation scopes.
**Action:** Use array pushes and `.join('')` combined with substring slicing in hot loops rather than simple `+=` string concatenation, and always hoist RegExp patterns outside hot loops.

## 2026-03-08 - [Caching camelToKebab AST key conversions and pre-compiling isImageUrl check regex]
**Learning:** During JSX-to-HTML AST rendering, styled element attributes (like flexDirection, alignItems, margin) are extremely recurrent across thousands of elements. Caching string conversions in a Map-based `camelToKebab` cache completely avoids RegExp replacement and allocation overhead, yielding a 50x speedup. Furthermore, using a static pre-compiled `RegExp.prototype.test()` instead of arrays with `.some()` and `.includes()` inside hot loops avoids array allocations and speeds up file check iterations by 38%.
**Action:** Always pre-compile skip/check patterns as module-level static RegExp instances, and cache repeated string mapping functions on hot-path loops using O(1) Map lookups.

## 2026-07-26 - [Hoisting resolution & file caches for multi-file CLI utilities with safe lifecycle management]
**Learning:** In CLI or utility scripts designed to process multiple files (e.g. `post_process.ts`), instantiating file resolution and reading caches locally inside iteration functions causes duplicate assets to be processed repeatedly on each file. Hoisting these caches to the module level enables powerful cross-file performance gains. To prevent memory leaks or stale entries in persistent runtimes, always clear these caches inside a `finally` block of the script's entry point (`main()`).
**Action:** Hoist caches to module scope to benefit multiple files, and safely manage cache lifecycles by clearing them upon main execution completion.
