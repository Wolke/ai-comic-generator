---
name: AI Comic Creator
description: Generate and iteratively edit comic pages using the Gemini Image API with multi-turn conversations. Supports reference images for character/scene consistency.
---

# AI Comic Creator Skill

This skill enables you to generate comic pages and iteratively edit them using the Gemini Image API, directly from the Antigravity chat.

## Prerequisites

- The user's **Gemini API Key** is needed. Check `localStorage` key `comic_gemini_api_key` via the browser, or ask the user directly. Store it in an environment variable for the scripts:
  ```bash
  export GEMINI_API_KEY="AIza..."
  ```

## Available Scripts

### 1. Generate a Comic Page

**Script**: `.agent/skills/ai-comic-creator/scripts/generate-comic-page.sh`

```bash
# Basic usage: generate from a prompt
.agent/skills/ai-comic-creator/scripts/generate-comic-page.sh \
  --api-key "$GEMINI_API_KEY" \
  --prompt "Generate a COMPLETE comic page with 4 panels..." \
  --output /tmp/comic-page-1.png

# With reference images (character/scene)
.agent/skills/ai-comic-creator/scripts/generate-comic-page.sh \
  --api-key "$GEMINI_API_KEY" \
  --prompt "Generate a COMPLETE comic page..." \
  --ref-image /path/to/character.png "Character 咪咪" \
  --ref-image /path/to/scene.png "Scene 咖啡廳" \
  --output /tmp/comic-page-1.png

# With specific model and aspect ratio
.agent/skills/ai-comic-creator/scripts/generate-comic-page.sh \
  --api-key "$GEMINI_API_KEY" \
  --model "gemini-2.0-flash-exp" \
  --aspect-ratio "3:4" \
  --prompt "..." \
  --output /tmp/comic-page-1.png
```

### 2. Edit an Existing Image (Multi-Turn)

**Script**: `.agent/skills/ai-comic-creator/scripts/edit-image.sh`

```bash
# Edit a previously generated image
.agent/skills/ai-comic-creator/scripts/edit-image.sh \
  --api-key "$GEMINI_API_KEY" \
  --input /tmp/comic-page-1.png \
  --instruction "把角色放大一點，背景改成夜晚" \
  --output /tmp/comic-page-1-v2.png

# Chain multiple edits (pass previous output as input)
.agent/skills/ai-comic-creator/scripts/edit-image.sh \
  --api-key "$GEMINI_API_KEY" \
  --input /tmp/comic-page-1-v2.png \
  --instruction "在右上角加一個月亮" \
  --output /tmp/comic-page-1-v3.png
```

## Workflow: Generating a Comic Page from the Project

When the user asks to generate a comic page, follow these steps:

### Step 1: Gather Data from the Project

The project stores comic data in its React state. To build the prompt, read the relevant source files:

- **Storyboard prompt builder**: `services/geminiService.ts` → `buildPageStoryboardPrompt()`
- **Prompt templates**: `services/promptTemplates.ts`
- **Type definitions**: `types.ts` (ComicCharacter, ComicScene, ComicPageData)

### Step 2: Build the Prompt

Construct a storyboard prompt following the format in `buildPageStoryboardPrompt()`:

```markdown
Generate a COMPLETE comic/manga page with N panel(s).

## CHARACTER IDENTITY
- **角色名** (reference image provided — MUST match this appearance)

## PAGE LAYOUT (N panels)

### Panel 1 [Wide/landscape panel (full width)]
**Characters**: Character A = 角色名
**Visual**: Wide shot of The Scene. Character A is...
**Dialogue bubbles**:
  💬 [bubble tail → 角色名]: "對話文字"

## STYLE
Japanese manga style, black and white ink...

## IMPORTANT RULES
- Draw this as a SINGLE comic page with clear panel borders/gutters
- **CRITICAL**: If reference images are provided, characters MUST visually match those reference images exactly.
...
```

### Step 3: Generate the Image

Use `generate-comic-page.sh` with any character/scene reference images found in the project.

### Step 4: Show the Result

Save the output image and embed it in the response using:
```markdown
![Comic Page 1](/tmp/comic-page-1.png)
```

### Step 5: Handle Follow-up Edits

When the user asks to modify the generated image:
1. Use `edit-image.sh` with the previous output as `--input`
2. Save the new version with a version suffix (e.g., `-v2.png`)
3. Show the updated image

## API Details

### Supported Models for Image Generation

| Model | Best For |
|-------|---------|
| `gemini-2.0-flash-exp` | Fast generation, experimental |
| `gemini-2.5-flash-image` | Speed + quality balance |
| `gemini-3-pro-image-preview` | Best quality, 4K, Thinking mode |
| `gemini-3.1-flash-image-preview` | **Recommended** — best all-around, multi-turn |

### REST API Format for Multi-Turn Editing

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "Original prompt..." }]
    },
    {
      "role": "model",
      "parts": [{ "inlineData": { "mimeType": "image/png", "data": "<base64_of_generated_image>" } }]
    },
    {
      "role": "user",
      "parts": [{ "text": "把角色放大一點" }]
    }
  ],
  "generationConfig": {
    "responseModalities": ["IMAGE"]
  }
}
```

### Key Notes

- `responseModalities: ["IMAGE"]` → returns only image
- `responseModalities: ["TEXT", "IMAGE"]` → returns text explanation + image
- Aspect ratio options: `"1:1"`, `"3:4"`, `"4:3"`, `"9:16"`, `"16:9"`
- Max inline image size: ~20MB base64
- For multi-turn, always include ALL previous turns in the `contents` array
