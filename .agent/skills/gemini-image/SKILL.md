---
name: Gemini Image Generation & Editing
description: Generate and iteratively edit images using Gemini's image generation API via multi-turn conversations.
---

# Gemini Image Generation & Editing Skill

This skill enables you to generate images and iteratively edit them using the Gemini API, directly from the Antigravity chat interface. It wraps the Gemini REST API in a shell script that handles base64 encoding/decoding, multi-turn history, and reference images.

## Prerequisites

- The user must have a Gemini API key. Check for `GEMINI_API_KEY` environment variable, or ask the user.
- The script is at: `.agent/skills/gemini-image/scripts/gemini-image.sh`
- Make sure the script is executable: `chmod +x .agent/skills/gemini-image/scripts/gemini-image.sh`

## Available Commands

### 1. Generate a New Image

Generate an image from a text prompt.

```bash
.agent/skills/gemini-image/scripts/gemini-image.sh generate \
  --api-key "$GEMINI_API_KEY" \
  --prompt "A cat sleeping on a windowsill in watercolor style" \
  --output /tmp/generated.png \
  --model "gemini-2.0-flash-exp" \
  --aspect-ratio "3:4"
```

**Parameters:**
- `--prompt` (required): Text description of the image to generate
- `--output` (required): Output file path (PNG)
- `--api-key` (required): Gemini API key
- `--model` (optional): Model name. Default: `gemini-2.0-flash-exp`. Options: `gemini-2.0-flash-exp`, `gemini-2.5-flash-preview-image`, `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`
- `--aspect-ratio` (optional): Aspect ratio. Default: `3:4`. Options: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`

### 2. Edit an Existing Image (Single Turn)

Send an existing image with an editing instruction.

```bash
.agent/skills/gemini-image/scripts/gemini-image.sh edit \
  --api-key "$GEMINI_API_KEY" \
  --input /path/to/image.png \
  --prompt "Change the background to a sunset" \
  --output /tmp/edited.png \
  --model "gemini-2.0-flash-exp"
```

**Parameters:**
- `--input` (required): Path to the source image (PNG/JPG)
- `--prompt` (required): Editing instruction
- `--output` (required): Output file path
- `--api-key` (required): Gemini API key
- `--model` (optional): Model name. Default: `gemini-2.0-flash-exp`

### 3. Multi-Turn Editing Session

Start or continue a multi-turn editing conversation. Each call appends to a history JSON file, enabling iterative refinement.

**Start a new session** (generates initial image):
```bash
.agent/skills/gemini-image/scripts/gemini-image.sh multi-turn \
  --api-key "$GEMINI_API_KEY" \
  --prompt "Generate a comic page with a cat waking up" \
  --output /tmp/comic_v1.png \
  --history /tmp/session.json \
  --model "gemini-3.1-flash-image-preview"
```

**Continue editing** (pass the same history file):
```bash
.agent/skills/gemini-image/scripts/gemini-image.sh multi-turn \
  --api-key "$GEMINI_API_KEY" \
  --prompt "Make the cat larger and change the background to nighttime" \
  --output /tmp/comic_v2.png \
  --history /tmp/session.json
```

**Parameters:**
- `--prompt` (required): Text instruction (generation or editing)
- `--output` (required): Output file path for this iteration
- `--history` (required): Path to session history JSON file (created automatically on first call)
- `--api-key` (required): Gemini API key
- `--model` (optional): Model name (only used on first call; subsequent calls reuse the model from history)
- `--ref-image` (optional, repeatable): Path to reference image(s) to include with the prompt

### 4. Add Reference Images

Any command can include reference images (character sheets, scene backgrounds):

```bash
.agent/skills/gemini-image/scripts/gemini-image.sh generate \
  --api-key "$GEMINI_API_KEY" \
  --prompt "Draw this character in a garden" \
  --ref-image /path/to/character.png \
  --ref-image /path/to/garden.png \
  --output /tmp/result.png
```

## Workflow Patterns

### Pattern A: Quick Single Image
User says: "幫我生成一張貓咪在月光下的圖"
1. Run `generate` with the prompt
2. Show the result to the user via `view_file`

### Pattern B: Iterative Editing
User says: "修改這張圖，把貓放大一點"
1. If no session exists, start `multi-turn` with the initial image + prompt
2. If session exists, continue `multi-turn` with the same `--history` file
3. Show updated result

### Pattern C: Comic Page Generation with References
User says: "用這些角色圖生成漫畫第一頁"
1. Locate character/scene images in the project or /tmp
2. Run `generate` or `multi-turn` with `--ref-image` flags
3. Show result

### Pattern D: Edit a Previously Downloaded Comic Page
User provides a PNG from the web app:
1. Run `edit` with the image + user's instruction
2. Show result, ask if they want further edits
3. If yes, switch to `multi-turn` mode for continued iteration

## Important Notes

- **History files** are stored in `/tmp/gemini-session-*.json`. Each session is independent.
- **Output images** are PNG format.
- When the user says "繼續修改" or "再改一下", always reuse the existing `--history` file for the active session.
- When the user starts a completely new topic/image, create a new session.
- The `responseModalities` is set to `["TEXT", "IMAGE"]` for multi-turn so the model can return text explanations alongside images.
- Always show the generated image to the user using `view_file` after generation.
