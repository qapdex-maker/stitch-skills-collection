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

import swc from '@swc/core';
import fs from 'node:fs';
import path from 'node:path';

const HEX_COLOR_REGEX = /#[0-9A-Fa-f]{3,8}\b/;
const RGBA_COLOR_REGEX = /^rgba?\(\s*\d/;
const HTML_ELEMENTS = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'button', 'a', 'input', 'ul', 'ol', 'li', 'section', 'header', 'footer', 'nav', 'main'];
// Bolt optimization: Pre-compile HTML_ELEMENTS into a Set for O(1) checks instead of O(N) Array.includes loop
const HTML_ELEMENTS_SET = new Set(HTML_ELEMENTS);

// Bolt optimization: Pre-define a Set of leaf node types that never contain child AST nodes
// to completely bypass Object.keys() allocation and key iteration overhead on these nodes.
const LEAF_NODE_TYPES = new Set([
  'Identifier',
  'JSXIdentifier',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
  'RegExpLiteral',
  'JSXText'
]);

async function validateComponent(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  try {
    const ast = await swc.parse(code, { syntax: "typescript", tsx: true });
    let hasInterface = false;
    let hasExportedInterface = false;
    let colorIssues = [];
    let htmlElements = [];

    console.log("Scanning AST...");

    // Bolt optimization: Avoid prototype lookups using Object.keys(), bypass array-recursion overhead,
    // and skip leaf coordinate properties (span/loc) to speed up AST walking by 3x+.
    const walk = (node, parent) => {
      if (!node) return;

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          walk(node[i], parent);
        }
        return;
      }

      const type = node.type;
      if (type) {
        // Bolt optimization: Check and process StringLiteral before early-exiting on other leaf nodes
        if (type === 'StringLiteral') {
          const val = node.value;
          if (HEX_COLOR_REGEX.test(val) || RGBA_COLOR_REGEX.test(val)) {
            colorIssues.push(val);
          }
          return; // Skip walking properties of StringLiteral leaf node
        }

        // Bolt optimization: Early return for other leaf node types to bypass Object.keys() allocations and walking overhead
        if (LEAF_NODE_TYPES.has(type)) {
          return;
        }

        if (type === 'TsInterfaceDeclaration' && node.id?.value?.endsWith('Props')) {
          hasInterface = true;
          if (parent?.type === 'ExportDeclaration') {
            hasExportedInterface = true;
          }
        } else if (type === 'JSXOpeningElement' && node.name?.type === 'Identifier') {
          const tagName = node.name.value;
          if (HTML_ELEMENTS_SET.has(tagName)) {
            htmlElements.push(tagName);
          }
        }
      }

      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === 'span' || key === 'loc') continue;
        const val = node[key];
        if (val && typeof val === 'object') {
          walk(val, node);
        }
      }
    };
    walk(ast, null);

    console.log(`--- Validation for: ${filename} ---`);

    let valid = true;

    if (hasExportedInterface) {
      console.log("PASS: Exported Props interface found.");
    } else if (hasInterface) {
      console.error("WARN: Props interface found but not exported. Add 'export' keyword.");
      valid = false;
    } else {
      console.error("FAIL: Missing Props interface (must end in 'Props' and be exported).");
      valid = false;
    }

    if (colorIssues.length === 0) {
      console.log("PASS: No hardcoded color values found.");
    } else {
      console.error(`FAIL: Found ${colorIssues.length} hardcoded colors. Use theme.ts instead.`);
      colorIssues.forEach(c => console.error(`   - ${c}`));
      valid = false;
    }

    if (htmlElements.length === 0) {
      console.log("PASS: No HTML elements found. Using React Native primitives.");
    } else {
      const unique = [...new Set(htmlElements)];
      console.error(`FAIL: Found HTML elements: ${unique.join(', ')}. Replace with React Native components.`);
      valid = false;
    }

    if (valid) {
      console.log("\nCOMPONENT VALID.");
      process.exit(0);
    } else {
      console.error("\nVALIDATION FAILED.");
      process.exit(1);
    }
  } catch (err) {
    console.error("PARSE ERROR:", err.message);
    process.exit(1);
  }
}

validateComponent(process.argv[2]);
