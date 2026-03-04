#!/bin/bash
# edit-image.sh — Edit an existing image using Gemini multi-turn Image API
#
# Usage:
#   ./edit-image.sh \
#     --api-key "AIza..." \
#     --input /tmp/comic-page.png \
#     --instruction "把角色放大一點" \
#     --output /tmp/comic-page-v2.png \
#     [--model "gemini-2.0-flash-exp"] \
#     [--original-prompt "Original generation prompt..."]

set -euo pipefail

API_KEY=""
MODEL="gemini-2.0-flash-exp"
INPUT=""
INSTRUCTION=""
OUTPUT=""
ORIGINAL_PROMPT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key) API_KEY="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --input) INPUT="$2"; shift 2 ;;
    --instruction) INSTRUCTION="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --original-prompt) ORIGINAL_PROMPT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$API_KEY" ]]; then echo "Error: --api-key is required"; exit 1; fi
if [[ -z "$INPUT" ]]; then echo "Error: --input is required"; exit 1; fi
if [[ -z "$INSTRUCTION" ]]; then echo "Error: --instruction is required"; exit 1; fi
if [[ -z "$OUTPUT" ]]; then echo "Error: --output is required"; exit 1; fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: Input image not found: $INPUT" >&2
  exit 1
fi

# Encode the input image
B64=$(base64 < "$INPUT" | tr -d '\n')

# Detect mime type
MIME="image/png"
case "$INPUT" in
  *.jpg|*.jpeg) MIME="image/jpeg" ;;
  *.webp) MIME="image/webp" ;;
esac

# Build multi-turn contents
# Turn 1 (user): original prompt (or generic) → tells the model what the image is
# Turn 2 (model): the existing image → simulates model having generated it
# Turn 3 (user): the edit instruction

if [[ -n "$ORIGINAL_PROMPT" ]]; then
  USER_TURN1_TEXT="$ORIGINAL_PROMPT"
else
  USER_TURN1_TEXT="This is a comic/manga page that was previously generated."
fi

REQUEST_BODY=$(jq -n \
  --arg user1_text "$USER_TURN1_TEXT" \
  --arg model_mime "$MIME" \
  --arg model_data "$B64" \
  --arg user2_text "$INSTRUCTION" \
  '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": $user1_text}]
      },
      {
        "role": "model",
        "parts": [{"inlineData": {"mimeType": $model_mime, "data": $model_data}}]
      },
      {
        "role": "user",
        "parts": [{"text": $user2_text}]
      }
    ],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {"aspectRatio": "3:4"}
    }
  }')

echo "--- Editing image with Gemini API ($MODEL) ---" >&2
echo "Input: $INPUT" >&2
echo "Instruction: $INSTRUCTION" >&2

# Call API
URL="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}"

RESPONSE=$(curl -s -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -d "$REQUEST_BODY")

# Check for errors
ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  echo "API Error: $ERROR" >&2
  exit 1
fi

# Extract base64 image data
IMAGE_DATA=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data // empty')

if [[ -z "$IMAGE_DATA" ]]; then
  echo "Error: No image in API response" >&2
  # Try to show text response if any
  TEXT_RESP=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[] | select(.text) | .text // empty')
  if [[ -n "$TEXT_RESP" ]]; then
    echo "Model response (text): $TEXT_RESP" >&2
  fi
  exit 1
fi

# Save image
echo "$IMAGE_DATA" | base64 -d > "$OUTPUT"
echo "✅ Edited image saved to: $OUTPUT" >&2
echo "$OUTPUT"
