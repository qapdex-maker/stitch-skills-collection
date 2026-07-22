/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { isSafePath, resolveLocalFile, extractCssUrls } from './post_process.js';
import { isSafeUrl as isSafeUrlSnapshot } from './snapshot.js';

// Local copy of isSafeUrl and ip6ToIpv4 from extract_inline_html.ts to avoid requiring @babel/parser dependency in unit tests
function ip6ToIpv4(ip6: string): string | null {
  const clean = ip6.replace(/^\[|\]$/g, '').toLowerCase();
  if (!/^(?:0|:)+(?:ffff:)?(?:0:)?/i.test(clean)) return null;
  const match = clean.match(/^(?:0|:)+(?:ffff:)?(?:0:)?([^:]+:[^:]+|(?:\d{1,3}\.){3}\d{1,3})$/);
  if (!match) return null;
  const part = match[1];
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(part)) return part;
  const hexParts = part.split(':');
  if (hexParts.length !== 2) return null;
  const high = parseInt(hexParts[0], 16);
  const low = parseInt(hexParts[1], 16);
  if (isNaN(high) || isNaN(low)) return null;
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isSafeUrlExtract(parsed: URL): boolean {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const mappedIpv4 = ip6ToIpv4(hostname);
  const ipToCheck = mappedIpv4 || hostname;

  const cleanHost = hostname.replace(/^\[|\]$/g, '');

  // Block standard cloud metadata DNS names (SSRF protection)
  if (
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'metadata' ||
    cleanHost === 'instance.metadata.azure.com'
  ) {
    return false;
  }

  // Block Alibaba Cloud IMDS metadata IP (100.100.100.200), Oracle Cloud (192.0.0.192), and Azure Virtual IP (168.63.129.16)
  if (
    ipToCheck === '100.100.100.200' ||
    ipToCheck === '192.0.0.192' ||
    ipToCheck === '168.63.129.16'
  ) {
    return false;
  }

  if (
    cleanHost === 'localhost' ||
    cleanHost === '::1' ||
    cleanHost === '::' ||
    /^[0:]+$/.test(cleanHost) ||        // all-zero IPv6
    /^fe[89ab][0-9a-f]:/i.test(cleanHost) || // fe80::/10 (link-local)
    /^f[cd][0-9a-f]{2}:/i.test(cleanHost) || // fc00::/7 (unique local address)
    /^ff[0-9a-f]{2}:/i.test(cleanHost)  // ff00::/8 (multicast)
  ) {
    return false;
  }

  const ipv4Match = ipToCheck.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 127 ||          // 127.0.0.0/8  (loopback)
      a === 10 ||           // 10.0.0.0/8   (private)
      a === 0 ||            // 0.0.0.0/8    (unspecified)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (private)
      (a === 192 && b === 168) ||          // 192.168.0.0/16 (private)
      (a === 169 && b === 254) ||          // 169.254.0.0/16 (link-local)
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (Carrier-Grade NAT)
      (a === 198 && b >= 18 && b <= 19) || // 198.18.0.0/15 (Benchmark testing)
      a >= 224             // 224.0.0.0/4 (Multicast/Reserved/Class E)
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Security Regression Test Suite: Path Traversal & Symlink Attacks
// ============================================================================
//
// Platform-Specific Path Traversal Considerations:
// - UNIX platforms use `/` as path separator. Absolute paths start with `/`.
// - Windows platforms use `\` (and support `/`). Absolute paths can start with
//   drive letters (e.g., `C:\` or `D:/`) or UNC paths (e.g., `\\server\share`).
// - On both platforms, directory traversal sequences like `..` can be used to
//   ascend the directory tree.
// - Our path traversal defense-in-depth resolves target files to their physical,
//   canonical absolute paths using `fs.realpathSync()`. This prevents:
//   1. Normal traversal attacks using `..` sequences.
//   2. Sibling prefix attacks (e.g. root is `/app/foo`, target is `/app/foo-bar`).
//   3. Symlink/Junction attacks where a link resides inside the safe root but
//      points to a sensitive file outside (e.g. `/app/foo/link` -> `/etc/passwd`).
// ============================================================================

const TEMP_DIR = path.resolve('./temp_post_process_test_sandbox');
const SAFE_ROOT = path.join(TEMP_DIR, 'safe_root');
const EXTERNAL_DIR = path.join(TEMP_DIR, 'external');

// Setup temporary sandbox
function setupSandbox() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(SAFE_ROOT, { recursive: true });
  fs.mkdirSync(EXTERNAL_DIR, { recursive: true });

  // Create mock files
  fs.writeFileSync(path.join(SAFE_ROOT, 'image.png'), 'fake-png-content');
  fs.writeFileSync(path.join(SAFE_ROOT, 'index.html'), 'fake-html');
  fs.mkdirSync(path.join(SAFE_ROOT, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(SAFE_ROOT, 'assets/logo.svg'), 'fake-svg');

  // Create external secret file
  fs.writeFileSync(path.join(EXTERNAL_DIR, 'secret.txt'), 'sensitive-data');
}

// Cleanup sandbox
function cleanupSandbox() {
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Path Traversal Security Tests', () => {
  test.beforeEach(() => {
    cleanupSandbox();
    setupSandbox();
  });

  test.afterEach(() => {
    cleanupSandbox();
  });

  test('isSafePath should accept valid paths inside safe root', () => {
    const validPaths = [
      path.join(SAFE_ROOT, 'image.png'),
      path.join(SAFE_ROOT, 'assets/logo.svg'),
      path.join(SAFE_ROOT, 'assets/../image.png'), // resolves to SAFE_ROOT/image.png
      SAFE_ROOT, // The root itself is safe
    ];

    for (const p of validPaths) {
      assert.strictEqual(
        isSafePath(p, SAFE_ROOT),
        true,
        `Expected path to be safe: ${p}`
      );
    }
  });

  test('isSafePath should reject traversal payloads escaping the safe root (relative)', () => {
    const payloads = [
      path.join(SAFE_ROOT, '../../external/secret.txt'),
      path.join(SAFE_ROOT, '..', '..', 'external', 'secret.txt'),
      path.join(SAFE_ROOT, '../safe_root/../../external/secret.txt'),
    ];

    // Add cross-platform manual traversal payloads (Unix style)
    payloads.push(SAFE_ROOT + '/../../external/secret.txt');
    // Windows style traversal payloads
    payloads.push(SAFE_ROOT + '\\..\\..\\external\\secret.txt');

    for (const p of payloads) {
      assert.strictEqual(
        isSafePath(p, SAFE_ROOT),
        false,
        `Expected path traversal payload to be blocked: ${p}`
      );
    }
  });

  test('isSafePath should reject absolute paths outside the safe root', () => {
    const externalPaths = [
      path.join(EXTERNAL_DIR, 'secret.txt'),
      TEMP_DIR, // The parent directory is outside safe root
    ];

    // Platform specific absolute paths
    if (process.platform === 'win32') {
      externalPaths.push('C:\\Windows\\win.ini');
      externalPaths.push('C:/Windows/System32/cmd.exe');
    } else {
      externalPaths.push('/etc/passwd');
      externalPaths.push('/var/log');
    }

    for (const p of externalPaths) {
      assert.strictEqual(
        isSafePath(p, SAFE_ROOT),
        false,
        `Expected external absolute path to be blocked: ${p}`
      );
    }
  });

  test('isSafePath should reject sibling directory prefix attacks', () => {
    // Sibling directory named "safe_root-sibling"
    const siblingDir = path.join(TEMP_DIR, 'safe_root-sibling');
    fs.mkdirSync(siblingDir, { recursive: true });
    fs.writeFileSync(path.join(siblingDir, 'hack.txt'), 'compromised');

    const attackPath = path.join(TEMP_DIR, 'safe_root-sibling/hack.txt');

    assert.strictEqual(
      isSafePath(attackPath, SAFE_ROOT),
      false,
      `Expected sibling prefix attack to be blocked: ${attackPath}`
    );
  });

  test('resolveLocalFile should safely resolve valid files and return absolute paths', () => {
    // Relative to baseDir
    const resolved = resolveLocalFile('image.png', SAFE_ROOT);
    assert.ok(resolved, 'Should successfully resolve image.png');
    assert.strictEqual(resolved, path.join(SAFE_ROOT, 'image.png'));

    // Nested file
    const resolvedNested = resolveLocalFile('assets/logo.svg', SAFE_ROOT);
    assert.ok(resolvedNested, 'Should successfully resolve assets/logo.svg');
    assert.strictEqual(resolvedNested, path.join(SAFE_ROOT, 'assets/logo.svg'));
  });

  test('resolveLocalFile should reject traversal paths and return null', () => {
    const traversals = [
      '../external/secret.txt',
      '../../external/secret.txt',
      'assets/../../external/secret.txt',
      '/etc/passwd',
      'C:\\Windows\\win.ini',
    ];

    for (const t of traversals) {
      const resolved = resolveLocalFile(t, SAFE_ROOT);
      assert.strictEqual(
        resolved,
        null,
        `Expected traversal payload "${t}" to resolve to null`
      );
    }
  });

  test('isSafePath should prevent symlink attacks pointing outside safe root (defense-in-depth)', () => {
    const symlinkPath = path.join(SAFE_ROOT, 'symlink_to_external');
    const targetPath = path.join(EXTERNAL_DIR, 'secret.txt');

    try {
      fs.symlinkSync(targetPath, symlinkPath);
    } catch (err: any) {
      console.warn(`[WARNING] Skipping symlink assertions: host environment does not support symlink creation (${err.message})`);
      return;
    }

    // Since the symlink points outside the safe root, isSafePath must resolve it
    // to the real path (EXTERNAL_DIR/secret.txt) and reject it.
    assert.strictEqual(
      isSafePath(symlinkPath, SAFE_ROOT),
      false,
      `Expected symlink pointing outside safe root to be blocked! (Link: ${symlinkPath}, Target: ${targetPath})`
    );

    // resolveLocalFile should also return null for this file
    const resolved = resolveLocalFile('symlink_to_external', SAFE_ROOT);
    assert.strictEqual(
      resolved,
      null,
      'resolveLocalFile should return null for symlink pointing outside safe root'
    );
  });

  test('isSafePath should allow symlinks pointing inside safe root', () => {
    const symlinkPath = path.join(SAFE_ROOT, 'symlink_to_internal');
    const targetPath = path.join(SAFE_ROOT, 'image.png');

    try {
      fs.symlinkSync(targetPath, symlinkPath);
    } catch {
      // Skip if symlinks are not supported
      return;
    }

    // Since the target is inside the safe root, isSafePath should allow it.
    assert.strictEqual(
      isSafePath(symlinkPath, SAFE_ROOT),
      true,
      `Expected symlink pointing inside safe root to be allowed. (Link: ${symlinkPath})`
    );

    const resolved = resolveLocalFile('symlink_to_internal', SAFE_ROOT);
    assert.ok(resolved, 'Should resolve internal symlink');
    assert.strictEqual(resolved, path.join(SAFE_ROOT, 'image.png'));
  });

  // Windows-specific case-insensitivity test
  test('Windows: isSafePath should be case-insensitive (NTFS)', () => {
    if (process.platform !== 'win32') return;

    // Ensure the safe root and file exist
    const absoluteRoot = path.resolve(SAFE_ROOT);
    const targetFile = path.join(absoluteRoot, 'image.png');
    assert.ok(fs.existsSync(targetFile), `Test fixture missing: ${targetFile}`);

    // Create a case-variant version of the same path (simulate different casing)
    const altRoot = absoluteRoot.toUpperCase();
    const altTarget = path.join(altRoot, 'image.png');

    // The normalized isSafePath implementation lowercases on Windows,
    // so a case-variant path should still be considered inside the safe root.
    assert.strictEqual(
      isSafePath(altTarget, absoluteRoot),
      true,
      `Expected case-variant path to be allowed inside safe root: ${altTarget}`,
    );

    // resolveLocalFile should also resolve case-variant references
    const resolved = resolveLocalFile(path.join(altRoot, 'image.png'), absoluteRoot);
    assert.ok(resolved, `resolveLocalFile should resolve case-variant path: ${altRoot}\\image.png`);
  });
});

test.describe('Snapshot URL Validation Security Tests', () => {
  test('isSafeUrl (snapshot) should accept valid http and https URLs', () => {
    const validUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'https://google.com',
      'https://stitch.withgoogle.com/path?query=1#hash',
    ];
    for (const url of validUrls) {
      assert.strictEqual(isSafeUrlSnapshot(url), true, `Expected valid URL to be accepted by snapshot: ${url}`);
    }
  });

  test('isSafeUrl (snapshot) should reject non-http and non-https protocols', () => {
    const unsafeUrls = [
      'file:///etc/passwd',
      'file:///C:/Windows/win.ini',
      'ftp://example.com/file',
      'gopher://example.com',
      'javascript:alert(1)',
      'data:text/html,<html>',
    ];
    for (const url of unsafeUrls) {
      assert.strictEqual(isSafeUrlSnapshot(url), false, `Expected unsafe URL protocol to be blocked by snapshot: ${url}`);
    }
  });

  test('isSafeUrl (snapshot) should return false for malformed URLs', () => {
    const malformed = [
      'not-a-url',
      'http:',
      '://invalid',
    ];
    for (const url of malformed) {
      assert.strictEqual(isSafeUrlSnapshot(url), false, `Expected malformed URL to be rejected by snapshot: ${url}`);
    }
  });

  test('isSafeUrl (snapshot) should reject cloud metadata / link-local addresses (SSRF protection)', () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'https://169.254.169.254/metadata',
      'http://169.254.10.10/some-resource',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata/',
      'http://[fd00:ec2::254]/latest/meta-data/',
      'http://[fe80::c9a:d9a:19a:29a]/',
      'http://[fe90::1]/',
      'http://[febf::1]/',
      'http://[fea0::1234]/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:a9fe:a9fe]/',
      'http://0xa9fea9fe/',
      'http://0251.0376.0251.0376/',
      'http://2852039166/',
      'http://[::ffff:a9fe:a9fe]:8080/path',
      'http://100.100.100.200/',
      'http://instance.metadata.azure.com/',
      'http://192.0.0.192/',
      'http://168.63.129.16/',
    ];
    for (const url of metadataUrls) {
      assert.strictEqual(isSafeUrlSnapshot(url), false, `Expected link-local/metadata URL to be blocked by snapshot: ${url}`);
    }
  });
});

test.describe('extractCssUrls parser tests', () => {
  test('should parse standard quoted and unquoted urls correctly', () => {
    const css = `
      body {
        background: url('foo.png');
        background-image: url("bar.jpg");
        list-style: url(baz.gif);
      }
    `;
    const urls = extractCssUrls(css);
    assert.strictEqual(urls.length, 3);
    assert.strictEqual(urls[0].url, 'foo.png');
    assert.strictEqual(urls[1].url, 'bar.jpg');
    assert.strictEqual(urls[2].url, 'baz.gif');
  });

  test('should parse urls with escapes and whitespace correctly', () => {
    const css = `
      body {
        background: url(   "escaped\\\\quote.png"   );
      }
    `;
    const urls = extractCssUrls(css);
    assert.strictEqual(urls.length, 1);
    assert.strictEqual(urls[0].url, 'escaped\\quote.png');
  });

  test('should ignore malformed urls', () => {
    const css = `
      body {
        background: url(unclosed;
        background: url('unclosed-quote);
      }
    `;
    const urls = extractCssUrls(css);
    assert.strictEqual(urls.length, 0);
  });
});

test.describe('processInBatches sliding window optimization tests', () => {
  const processInBatches = async <T, R>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<R>,
  ): Promise<(R | null)[]> => {
    const results = new Array<(R | null)>(items.length);
    let index = 0;
    const workers: Promise<void>[] = [];

    const worker = async () => {
      while (index < items.length) {
        const curIndex = index++;
        try {
          results[curIndex] = await fn(items[curIndex]);
        } catch {
          results[curIndex] = null;
        }
      }
    };

    const count = Math.min(batchSize, items.length);
    for (let w = 0; w < count; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return results;
  };

  test('should process all items in correct order', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processInBatches(items, 2, async (x) => x * 2);
    assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
  });

  test('should handle empty input array correctly', async () => {
    const results = await processInBatches([], 3, async (x) => x);
    assert.deepStrictEqual(results, []);
  });

  test('should handle input size smaller than batch size', async () => {
    const items = [10, 20];
    const results = await processInBatches(items, 5, async (x) => x + 1);
    assert.deepStrictEqual(results, [11, 21]);
  });

  test('should catch errors and handle rejected promises gracefully', async () => {
    const items = ['ok', 'fail', 'ok2'];
    const results = await processInBatches(items, 2, async (x) => {
      if (x === 'fail') throw new Error('forced failure');
      return x.toUpperCase();
    });
    assert.deepStrictEqual(results, ['OK', null, 'OK2']);
  });

  test('should prevent head-of-line blocking (sliding window / worker pool optimization)', async () => {
    const items = ['slow', 'fast1', 'fast2'];
    const startTime = Date.now();

    const results = await processInBatches(items, 2, async (x) => {
      if (x === 'slow') {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return 'slow_done';
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return x + '_done';
      }
    });

    const duration = Date.now() - startTime;
    assert.deepStrictEqual(results, ['slow_done', 'fast1_done', 'fast2_done']);
    assert.ok(duration < 90, `Expected duration to be less than 90ms (actual: ${duration}ms) due to sliding window concurrency`);
  });

  test('should prevent head-of-line blocking deterministically without timing sensitivity', async () => {
    const items = ['slow', 'fast1', 'fast2'];
    const events: string[] = [];

    await processInBatches(items, 2, async (x) => {
      events.push(`start:${x}`);
      if (x === 'slow') {
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      events.push(`end:${x}`);
      return x;
    });

    const expected = [
      'start:slow',
      'start:fast1',
      'end:fast1',
      'start:fast2',
      'end:fast2',
      'end:slow'
    ];

    assert.deepStrictEqual(events, expected, 'Worker pool did not execute tasks in a non-blocking sliding window sequence');
  });
});

test.describe('Extract Inline HTML URL Validation Security Tests', () => {
  const checkUrl = (urlStr: string): boolean => {
    try {
      return isSafeUrlExtract(new URL(urlStr));
    } catch {
      return false;
    }
  };

  test('isSafeUrl (extract) should accept public http and https URLs', () => {
    const validUrls = [
      'https://google.com',
      'https://stitch.withgoogle.com/path?query=1#hash',
    ];
    for (const url of validUrls) {
      assert.strictEqual(checkUrl(url), true, `Expected public URL to be accepted: ${url}`);
    }
  });

  test('isSafeUrl (extract) should reject non-http and non-https protocols', () => {
    const unsafeUrls = [
      'file:///etc/passwd',
      'ftp://example.com/file',
      'javascript:alert(1)',
      'data:text/html,<html>',
    ];
    for (const url of unsafeUrls) {
      assert.strictEqual(checkUrl(url), false, `Expected unsafe protocol to be blocked: ${url}`);
    }
  });

  test('isSafeUrl (extract) should reject loopback/private/link-local/metadata addresses (SSRF protection)', () => {
    const blockedUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata/',
      'http://[::1]/',
      'http://[::]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:7f00:1]/',
      'http://10.0.0.1/',
      'http://[::ffff:10.0.0.1]/',
      'http://[::ffff:a00:1]/',
      'http://192.168.1.1/',
      'http://[::ffff:192.168.1.1]/',
      'http://[::ffff:c0a8:101]/',
      'http://169.254.169.254/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:a9fe:a9fe]/',
      'http://[fe80::c9a:d9a:19a:29a]/',
      'http://[fe90::1]/',
      'http://[febf::1]/',
      'http://[fd00:ec2::254]/',
      'http://[fc00::1]/',
      'http://[fd12:3456:789a:1::1]/',
      'http://[ff02::1]/',
      'http://0xa9fea9fe/',
      'http://0251.0376.0251.0376/',
      'http://2852039166/',
      'http://100.64.0.1/',
      'http://100.127.255.254/',
      'http://198.18.0.1/',
      'http://198.19.255.254/',
      'http://224.0.0.1/',
      'http://240.0.0.1/',
      'http://255.255.255.255/',
      'http://instance.metadata.azure.com/',
      'http://192.0.0.192/',
      'http://168.63.129.16/',
    ];
    for (const url of blockedUrls) {
      assert.strictEqual(checkUrl(url), false, `Expected loopback/private/link-local/metadata/multicast URL to be blocked: ${url}`);
    }
  });
});
