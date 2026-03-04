#!/usr/bin/env bash
# gemini-image.sh — Gemini Image Generation & Editing CLI
# Wraps the Gemini REST API for image generation, editing, and multi-turn sessions.
#
# Usage:
#   gemini-image.sh generate  --api-key KEY --prompt "..." --output out.png [--model ...] [--aspect-ratio ...]
#   gemini-image.sh edit      --api-key KEY --input img.png --prompt "..." --output out.png [--model ...]
#   gemini-image.sh multi-turn --api-key KEY --prompt "..." --output out.png --history session.json [--model ...] [--ref-image ...]

set -euo pipefail

# ============ Defaults ============
DEFAULT_MODEL="gemini-2.0-flash-exp"
DEFAULT_ASPECT_RATIO="3:4"
API_BASE="https://generativelanguage.googleapis.com/v1beta/models"

# ============ Helpers ============
die() { echo "ERROR: $*" >&2; exit 1; }

img_to_base64() {
    local file="$1"
    [[ -f "$file" ]] || die "Image file not found: $file"
    base64 -i "$file" | tr -d '\n'
}

detect_mime() {
    local file="$1"
    case "${file,,}" in
        *.png)  echo "image/png" ;;
        *.jpg|*.jpeg) echo "image/jpeg" ;;
        *.webp) echo "image/webp" ;;
        *.gif)  echo "image/gif" ;;
        *)      echo "image/png" ;;
    esac
}

base64_to_file() {
    local b64="$1" output="$2"
    echo "$b64" | base64 -d > "$output"
    echo "Image saved to: $output"
}

# ============ Generate (text → image) ============
cmd_generate() {
    local api_key="" prompt="" output="" model="$DEFAULT_MODEL" aspect_ratio="$DEFAULT_ASPECT_RATIO"
    local ref_images=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --api-key)      api_key="$2"; shift 2 ;;
            --prompt)       prompt="$2"; shift 2 ;;
            --output)       output="$2"; shift 2 ;;
            --model)        model="$2"; shift 2 ;;
            --aspect-ratio) aspect_ratio="$2"; shift 2 ;;
            --ref-image)    ref_images+=("$2"); shift 2 ;;
            *) die "Unknown option: $1" ;;
        esac
    done

    [[ -n "$api_key" ]] || die "--api-key is required"
    [[ -n "$prompt" ]]  || die "--prompt is required"
    [[ -n "$output" ]]  || die "--output is required"

    # Build parts array
    local parts_json=""
    parts_json=$(jq -n --arg text "$prompt" '[{"text": $text}]')

    # Add reference images
    for ref in "${ref_images[@]}"; do
        local mime b64
        mime=$(detect_mime "$ref")
        b64=$(img_to_base64 "$ref")
        parts_json=$(echo "$parts_json" | jq --arg mime "$mime" --arg data "$b64" \
            '. + [{"inlineData": {"mimeType": $mime, "data": $data}}]')
    done

    local body
    body=$(jq -n \
        --argjson parts "$parts_json" \
        --arg aspect "$aspect_ratio" \
        '{
            "contents": [{"parts": $parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {"aspectRatio": $aspect}
            }
        }')

    echo "Generating image with model: $model"
    echo "Prompt: ${prompt:0:200}..."

    local response
    response=$(curl -s -X POST \
        "${API_BASE}/${model}:generateContent?key=${api_key}" \
        -H "Content-Type: application/json" \
        -d "$body")

    # Check for errors
    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // empty')
    [[ -z "$error_msg" ]] || die "API error: $error_msg"

    # Extract image
    local image_data
    image_data=$(echo "$response" | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data' | head -1)
    [[ -n "$image_data" && "$image_data" != "null" ]] || die "No image in response"

    base64_to_file "$image_data" "$output"
}

# ============ Edit (image + text → image) ============
cmd_edit() {
    local api_key="" input="" prompt="" output="" model="$DEFAULT_MODEL"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --api-key) api_key="$2"; shift 2 ;;
            --input)   input="$2"; shift 2 ;;
            --prompt)  prompt="$2"; shift 2 ;;
            --output)  output="$2"; shift 2 ;;
            --model)   model="$2"; shift 2 ;;
            *) die "Unknown option: $1" ;;
        esac
    done

    [[ -n "$api_key" ]] || die "--api-key is required"
    [[ -n "$input" ]]   || die "--input is required"
    [[ -n "$prompt" ]]  || die "--prompt is required"
    [[ -n "$output" ]]  || die "--output is required"

    local mime b64
    mime=$(detect_mime "$input")
    b64=$(img_to_base64 "$input")

    local body
    body=$(jq -n \
        --arg text "$prompt" \
        --arg mime "$mime" \
        --arg data "$b64" \
        '{
            "contents": [{
                "parts": [
                    {"text": $text},
                    {"inlineData": {"mimeType": $mime, "data": $data}}
                ]
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"]
            }
        }')

    echo "Editing image with model: $model"
    echo "Instruction: ${prompt:0:200}..."

    local response
    response=$(curl -s -X POST \
        "${API_BASE}/${model}:generateContent?key=${api_key}" \
        -H "Content-Type: application/json" \
        -d "$body")

    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // empty')
    [[ -z "$error_msg" ]] || die "API error: $error_msg"

    # Print any text response
    local text_response
    text_response=$(echo "$response" | jq -r '.candidates[0].content.parts[] | select(.text) | .text' 2>/dev/null || true)
    [[ -z "$text_response" ]] || echo "Model says: $text_response"

    local image_data
    image_data=$(echo "$response" | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data' | head -1)
    [[ -n "$image_data" && "$image_data" != "null" ]] || die "No image in response"

    base64_to_file "$image_data" "$output"
}

# ============ Multi-Turn (conversational editing) ============
cmd_multi_turn() {
    local api_key="" prompt="" output="" history="" model="$DEFAULT_MODEL"
    local ref_images=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --api-key)   api_key="$2"; shift 2 ;;
            --prompt)    prompt="$2"; shift 2 ;;
            --output)    output="$2"; shift 2 ;;
            --history)   history="$2"; shift 2 ;;
            --model)     model="$2"; shift 2 ;;
            --ref-image) ref_images+=("$2"); shift 2 ;;
            *) die "Unknown option: $1" ;;
        esac
    done

    [[ -n "$api_key" ]] || die "--api-key is required"
    [[ -n "$prompt" ]]  || die "--prompt is required"
    [[ -n "$output" ]]  || die "--output is required"
    [[ -n "$history" ]] || die "--history is required"

    # Initialize or load history
    local contents_json
    if [[ -f "$history" ]]; then
        # Load existing history, extract model from it
        model=$(jq -r '.model' "$history")
        contents_json=$(jq '.contents' "$history")
        echo "Continuing session ($(echo "$contents_json" | jq 'length') turns so far)"
    else
        contents_json='[]'
        echo "Starting new session with model: $model"
    fi

    # Build new user turn parts
    local new_parts
    new_parts=$(jq -n --arg text "$prompt" '[{"text": $text}]')

    # Add reference images to this turn
    for ref in "${ref_images[@]}"; do
        local mime b64
        mime=$(detect_mime "$ref")
        b64=$(img_to_base64 "$ref")
        new_parts=$(echo "$new_parts" | jq --arg mime "$mime" --arg data "$b64" \
            '. + [{"inlineData": {"mimeType": $mime, "data": $data}}]')
    done

    # Append user turn to contents
    contents_json=$(echo "$contents_json" | jq --argjson parts "$new_parts" \
        '. + [{"role": "user", "parts": $parts}]')

    # Build request body
    local body
    body=$(jq -n \
        --argjson contents "$contents_json" \
        '{
            "contents": $contents,
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"]
            }
        }')

    echo "Prompt: ${prompt:0:200}..."

    local response
    response=$(curl -s -X POST \
        "${API_BASE}/${model}:generateContent?key=${api_key}" \
        -H "Content-Type: application/json" \
        -d "$body")

    local error_msg
    error_msg=$(echo "$response" | jq -r '.error.message // empty')
    [[ -z "$error_msg" ]] || die "API error: $error_msg"

    # Extract model response parts
    local model_parts
    model_parts=$(echo "$response" | jq '.candidates[0].content.parts')

    # Print any text
    local text_response
    text_response=$(echo "$model_parts" | jq -r '.[] | select(.text) | .text' 2>/dev/null || true)
    [[ -z "$text_response" ]] || echo "Model says: $text_response"

    # Extract and save image
    local image_data
    image_data=$(echo "$model_parts" | jq -r '.[] | select(.inlineData) | .inlineData.data' | head -1)
    [[ -n "$image_data" && "$image_data" != "null" ]] || die "No image in response"

    base64_to_file "$image_data" "$output"

    # Append model response to history
    # For storage efficiency, store image reference as a file path instead of inline base64
    # But for API calls, we need the actual base64, so we store it
    local model_turn
    model_turn=$(echo "$response" | jq '.candidates[0].content | . + {"role": "model"}')

    contents_json=$(echo "$contents_json" | jq --argjson turn "$model_turn" \
        '. + [$turn]')

    # Save updated history
    jq -n --arg model "$model" --argjson contents "$contents_json" \
        '{"model": $model, "contents": $contents}' > "$history"

    local turn_count
    turn_count=$(echo "$contents_json" | jq 'length')
    echo "Session saved: $history ($turn_count turns)"
}

# ============ Main ============
[[ $# -ge 1 ]] || die "Usage: $0 {generate|edit|multi-turn} [options]"

command="$1"
shift

case "$command" in
    generate)    cmd_generate "$@" ;;
    edit)        cmd_edit "$@" ;;
    multi-turn)  cmd_multi_turn "$@" ;;
    *)           die "Unknown command: $command. Use: generate, edit, multi-turn" ;;
esac
