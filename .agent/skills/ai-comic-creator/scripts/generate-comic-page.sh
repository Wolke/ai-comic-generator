#!/bin/bash
# generate-comic-page.sh — Generate a comic page image using Gemini Image API
#
# Usage:
#   ./generate-comic-page.sh \
#     --api-key "AIza..." \
#     --prompt "Generate a COMPLETE comic page..." \
#     --output /tmp/comic-page.png \
#     [--ref-image /path/to/img.png "Label"] \
#     [--model "gemini-2.0-flash-exp"] \
#     [--aspect-ratio "3:4"]

set -euo pipefail

API_KEY=""
MODEL="gemini-2.0-flash-exp"
PROMPT=""
OUTPUT=""
ASPECT_RATIO="3:4"
REF_IMAGES=()   # pairs of (path, label)
REF_LABELS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key) API_KEY="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --prompt) PROMPT="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --aspect-ratio) ASPECT_RATIO="$2"; shift 2 ;;
    --ref-image)
      REF_IMAGES+=("$2")
      REF_LABELS+=("$3")
      shift 3 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$API_KEY" ]]; then echo "Error: --api-key is required"; exit 1; fi
if [[ -z "$PROMPT" ]]; then echo "Error: --prompt is required"; exit 1; fi
if [[ -z "$OUTPUT" ]]; then echo "Error: --output is required"; exit 1; fi

# Build the text prompt with reference labels
TEXT_PROMPT=""
if [[ ${#REF_IMAGES[@]} -gt 0 ]]; then
  TEXT_PROMPT+="## REFERENCE IMAGES\nThe following reference images are provided. Use these for consistent character appearances and scene backgrounds:\n"
  for i in "${!REF_LABELS[@]}"; do
    TEXT_PROMPT+="- Image $((i+1)): ${REF_LABELS[$i]}\n"
  done
  TEXT_PROMPT+="\n"
fi
TEXT_PROMPT+="$PROMPT"

# Build JSON parts array
PARTS_JSON=$(jq -n --arg text "$TEXT_PROMPT" '[{"text": $text}]')

# Add reference images as inline data
for img_path in "${REF_IMAGES[@]}"; do
  if [[ -f "$img_path" ]]; then
    B64=$(base64 < "$img_path" | tr -d '\n')
    # Detect mime type
    MIME="image/png"
    case "$img_path" in
      *.jpg|*.jpeg) MIME="image/jpeg" ;;
      *.webp) MIME="image/webp" ;;
    esac
    PARTS_JSON=$(echo "$PARTS_JSON" | jq --arg data "$B64" --arg mime "$MIME" \
      '. + [{"inlineData": {"mimeType": $mime, "data": $data}}]')
  else
    echo "Warning: Reference image not found: $img_path" >&2
  fi
done

# Build request body
REQUEST_BODY=$(jq -n \
  --argjson parts "$PARTS_JSON" \
  --arg aspect "$ASPECT_RATIO" \
  '{
    "contents": [{"parts": $parts}],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {"aspectRatio": $aspect}
    }
  }')

echo "--- Calling Gemini API ($MODEL) ---" >&2
echo "Prompt length: ${#TEXT_PROMPT} chars" >&2
echo "Reference images: ${#REF_IMAGES[@]}" >&2

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
  echo "$RESPONSE" | jq '.candidates[0].content.parts[] | keys' >&2
  exit 1
fi

# Save image
echo "$IMAGE_DATA" | base64 -d > "$OUTPUT"
echo "✅ Image saved to: $OUTPUT" >&2
echo "$OUTPUT"
