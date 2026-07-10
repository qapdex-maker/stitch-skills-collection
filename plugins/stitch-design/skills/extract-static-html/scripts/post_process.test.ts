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
import { isSafePath, resolveLocalFile } from './post_process.js';

// ============================================================================
 jules-10539828095716908703-0f05f54d
// Security Regression Test Suite: Path Traversal & Symlink Attacks
=======
// Security Regression Test Suite: Path Traversal \u0026 Symlink Attacks
 main
// ============================================================================
//
// Platform-Specific Path Traversal Considerations:
// - UNIX platforms use `/` as path separator. Absolute paths start with `/`.
 jules-10539828095716908703-0f05f54d
// - Windows platforms use `\` (and support `/`). Absolute paths can start with
//   drive letters (e.g., `C:\` or `D:/`) or UNC paths (e.g., `\\server\share`).
=======
// - Windows platforms use `\\` (and support `/`). Absolute paths can start with
//   drive letters (e.g., `C:\\` or `D:/`) or UNC paths (e.g., `\\\\server\\share`).
 main
// - On both platforms, directory traversal sequences like `..` can be used to
//   ascend the directory tree.
// - Our path traversal defense-in-depth resolves target files to their physical,
//   canonical absolute paths using `fs.realpathSync()`. This prevents:
//   1. Normal traversal attacks using `..` sequences.
//   2. Sibling prefix attacks (e.g. root is `/app/foo`, target is `/app/foo-bar`).
//   3. Symlink/Junction attacks where a link resides inside the safe root but
 jules-10539828095716908703-0f05f54d
//      points to a sensitive file outside (e.g. `/app/foo/link` -> `/etc/passwd`).
=======
//      points to a sensitive file outside (e.g. `/app/foo/link` -\u003e `/etc/passwd`).
 main
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
 jules-10539828095716908703-0f05f54d
=======

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

 main
});
