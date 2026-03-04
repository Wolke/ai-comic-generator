---
name: AI Comic Creator
description: Generate and iteratively edit comic pages using the built-in generate_image tool. Supports reference images for character/scene consistency and multi-turn editing.
---

# AI Comic Creator Skill

Generate comic pages and iteratively edit them directly from the Antigravity chat, using the built-in `generate_image` tool.

## Core Workflow

### 1. Generate a Comic Page

Use the `generate_image` tool with a detailed storyboard prompt.

**Prompt structure** (follow `buildPageStoryboardPrompt` in `services/geminiService.ts`):

```markdown
Generate a COMPLETE comic/manga page with N panel(s).

## CHARACTER IDENTITY
- **角色名** (reference image provided — MUST match this appearance)

## PAGE LAYOUT (N panels)

### Panel 1 [Wide/landscape panel (full width)]
**Characters**: Character A = 角色名
**Visual**: Wide shot. Character A is doing...
**Dialogue bubbles**:
  💬 [bubble tail → 角色名]: "對話"

## STYLE
Japanese manga style, black and white ink, screentone shading...

## IMPORTANT RULES
- Draw as a SINGLE comic page with panel borders/gutters
- CRITICAL: Match reference images exactly for characters
- Speech bubbles: round, tail to speaker, NO names inside
- SFX: OVERSIZED bold stylized text
- Keep bubble text short and legible
```

**With reference images** — pass character/scene images via `ImagePaths`:
```
generate_image(
  Prompt: "...",
  ImageName: "comic_page_1",
  ImagePaths: ["/path/to/character.png", "/path/to/scene.png"]
)
```

### 2. Edit a Generated Image (Multi-Turn)

To modify a previously generated image, pass it back via `ImagePaths` with an edit instruction:

```
generate_image(
  Prompt: "Edit this comic page: 把角色放大一點，背景改成夜晚",
  ImageName: "comic_page_1_v2",
  ImagePaths: ["/path/to/previous/comic_page_1.png"]
)
```

Chain edits by always passing the latest version:
```
generate_image(
  Prompt: "Edit this comic page: 再加一些星星在天空",
  ImageName: "comic_page_1_v3",
  ImagePaths: ["/path/to/comic_page_1_v2.png"]
)
```

### 3. Reading Project Data

The project at `/Users/chienhunglin/radio-drama-2` contains:

| File | Data |
|------|------|
| `types.ts` | `ComicCharacter`, `ComicScene`, `ComicPageData` types |
| `services/geminiService.ts` | `buildPageStoryboardPrompt()` — prompt builder |
| `services/promptTemplates.ts` | Style presets, character/scene prompt templates |

When user asks to generate from their project data, read the source files to understand the storyboard structure and build the prompt accordingly.

## Fallback: Direct API Scripts

For advanced use cases needing specific models, aspect ratios, or true multi-turn conversation history, use the shell scripts:

- `scripts/generate-comic-page.sh` — Direct Gemini API call with `--ref-image` support
- `scripts/edit-image.sh` — Multi-turn editing with full conversation history

These require the user's Gemini API Key (stored in `localStorage` key `comic_gemini_api_key` or ask user).

## Style Presets

| Preset | Prompt Suffix |
|--------|--------------|
| Manga | Japanese manga style, black and white ink, screentone shading |
| Manhwa | Korean manhwa webtoon style, full color, clean digital art |
| Comic | American comic book style, bold outlines, vivid colors |
| Watercolor | Watercolor illustration, soft edges, gentle colors |
| Realistic | Realistic digital painting, cinematic lighting |
