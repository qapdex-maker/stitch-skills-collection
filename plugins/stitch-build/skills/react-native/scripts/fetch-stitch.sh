#!/bin/bash
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

URL=$1
OUTPUT=$2
if [ -z "$URL" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: $0 <url> <output_path>"
  exit 1
fi

# Security: prevent option injection (CWE-88) and enforce protocol restriction at shell boundary
if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "Error: URL must start with http:// or https://"
  exit 1
fi

if [[ "$OUTPUT" == -* ]]; then
  echo "Error: Output path cannot start with a hyphen"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
echo "Initiating high-reliability fetch for Stitch HTML..."
# Security: restrict protocols to HTTP/HTTPS to prevent protocol-based attacks (e.g. LFI/SSRF)
# Use -- to separate options from arguments
curl -L -f -sS --proto =http,https --connect-timeout 10 --compressed -o "$OUTPUT" -- "$URL"
if [ $? -eq 0 ]; then
  echo "Successfully retrieved HTML at: $OUTPUT"
  exit 0
else
  echo "Error: Failed to retrieve content. Check TLS/SNI or URL expiration."
  exit 1
fi
