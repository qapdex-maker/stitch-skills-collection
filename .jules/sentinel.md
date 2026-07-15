## 2026-03-03 - Path Traversal in Local Resource Inlining
**Vulnerability:** In post_process.ts, the function resolveLocalFile resolved local paths parsed from HTML/CSS files without validating if they traversed outside of the safe baseDir or project root, permitting arbitrary local file read.
**Learning:** Functions that parse and inline local file references (like src attributes or CSS url() patterns) are susceptible to Path Traversal (CWE-22) if they resolve paths using path.join or path.resolve without checking absolute containment against a designated safe root.
**Prevention:** Always resolve the absolute paths of both the target file and the safe root, and verify that the target path is equal to the root path or starts with the root path followed by the directory separator (e.g. absolutePath.startsWith(absoluteRoot + path.sep)).

## 2026-03-04 - Defense-in-depth against Symlink Path Traversal Attacks
**Vulnerability:** Even if absolute paths are validated using `path.resolve` and `startsWith`, symlink/junction-based directory traversal attacks can bypass this validation if a symlink resides inside the safe root but points to a file outside it. When the file is later opened, the system follows the symlink and reads the external file.
**Learning:** Checking paths solely via `path.resolve` is vulnerable to symlink bypass. To protect against this, we must resolve canonical physical paths using `fs.realpathSync`.
**Prevention:** Resolve canonical physical paths of both the target file and the safe root via `fs.realpathSync` before validating containment. Fall back gracefully to `path.resolve` if `realpathSync` fails (e.g. because the file does not exist yet). Ensure that functions returning resolved local files return the canonical physical path to prevent MIME resolution bypass or subsequent file access outside boundaries.

## 2026-03-05 - Headless Browser Arbitrary Protocol Loading (LFI/SSRF)
**Vulnerability:** In snapshot.ts, the Puppeteer headless browser was directed to navigate to any URL string supplied as a command-line argument without protocol or scheme restriction, allowing local system file exposure (CWE-22/CWE-918) via `file:///etc/passwd` or script execution via `javascript:...`.
**Learning:** Utilities utilizing browser automation tools (like Puppeteer, Playwright, or Selenium) to capture snapshots, scrape HTML, or render PDFs must explicitly restrict loaded protocols. Merely verifying that an input is a valid URL is insufficient since `file:`, `gopher:`, and `data:` schemes are still valid URLs.
**Prevention:** Always parse inputs using the `URL` constructor and strictly whitelist permitted protocols (e.g., matching `parsed.protocol === 'http:' || parsed.protocol === 'https:'`) before initiating browser navigation.
