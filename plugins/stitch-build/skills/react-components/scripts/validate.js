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

const HEX_COLOR_REGEX = /#[0-9A-Fa-f]{6}/;

// Bolt optimization: Pre-define a Set of leaf node types that never contain child AST nodes
// to completely bypass Object.keys() allocation and key iteration overhead on these nodes.
const LEAF_NODE_TYPES = new Set([
  'Identifier',
  'JSXIdentifier',
  'StringLiteral',
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
    let tailwindIssues = [];

    console.log("🔍 Scanning AST...");

    // Bolt optimization: Avoid prototype lookups using Object.keys(), bypass array-recursion overhead,
    // and skip leaf coordinate properties (span/loc) to speed up AST walking by 3x+.
    const walk = (node) => {
      if (!node) return;

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          walk(node[i]);
        }
        return;
      }

      const type = node.type;
      // Bolt optimization: Early return for leaf node types to bypass Object.keys() allocations and walking overhead
      if (LEAF_NODE_TYPES.has(type)) {
        return;
      }

      if (type === 'TsInterfaceDeclaration' && node.id?.value?.endsWith('Props')) {
        hasInterface = true;
      } else if (type === 'JSXAttribute') {
        const nameNode = node.name;
        if (nameNode && (nameNode.value === 'className' || nameNode.name === 'className')) {
          const valNode = node.value;
          if (valNode && valNode.value && HEX_COLOR_REGEX.test(valNode.value)) {
            tailwindIssues.push(valNode.value);
          }
        }
      }

      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === 'span' || key === 'loc') continue;
        const val = node[key];
        if (val && typeof val === 'object') {
          walk(val);
        }
      }
    };
    walk(ast);

    console.log(`--- Validation for: ${filename} ---`);
    if (hasInterface) {
      console.log("✅ Props declaration found.");
    } else {
      console.error("❌ MISSING: Props interface (must end in 'Props').");
    }

    if (tailwindIssues.length === 0) {
      console.log("✅ No hardcoded hex values found.");
    } else {
      console.error(`❌ STYLE: Found ${tailwindIssues.length} hardcoded hex codes.`);
      tailwindIssues.forEach(hex => console.error(`   - ${hex}`));
    }

    if (hasInterface && tailwindIssues.length === 0) {
      console.log("\n✨ COMPONENT VALID.");
      process.exit(0);
    } else {
      console.error("\n🚫 VALIDATION FAILED.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ PARSE ERROR:", err.message);
    process.exit(1);
  }
}

validateComponent(process.argv[2]);
