---
name: AI Comic Creator
description: Generate and iteratively edit comic pages using the built-in generate_image tool. Supports reference images for character/scene consistency and multi-turn editing.
---

# AI Comic Creator Skill

Generate comic pages and iteratively edit them directly from the Antigravity chat, using the built-in `generate_image` tool.

## ⚠️ Core Principle: One Image Per Call

AI image models perform poorly when given overly complex prompts. **ALWAYS decompose the work into small, focused tasks** and generate **one image per `generate_image` call**.

## Workflow: Generating a Multi-Page Comic

When the user requests a comic (e.g., "幫我畫一個 5 頁的漫畫"), follow this task-planning workflow:

### Phase 1: Planning — Create task.md & Draft Storyboard

1. **Create `task.md`** to break down the entire comic into individual work items:

```markdown
# Comic Generation: [Title]

## Characters
- [ ] Generate reference image: Character A (角色名)
- [ ] Generate reference image: Character B (角色名)

## Scenes
- [ ] Generate reference image: Scene 1 (場景名)

## Pages
- [ ] Page 1: [brief description] (4 panels)
- [ ] Page 2: [brief description] (3 panels)
- [ ] Page 3: [brief description] (5 panels)
...
```

2. **Create `comic_storyboard_draft.md`** containing the full storyboard — ALL pages, ALL panels, with prompts written out. This is a **text-only planning document** for the user to review and approve.

3. **Use `notify_user`** with `BlockedOnUser: true` to present both files for user approval. Do NOT generate any images yet.

### Phase 2: Execution — Generate Images One by One

After user approval, use `task_boundary` to track progress and generate images **sequentially**:

#### Step 1: Generate Character Reference Images (one per call)

```
task_boundary(TaskName: "Generating Character References", ...)

generate_image(
  Prompt: "Full body character portrait of [detailed description]. Character concept art, clean white background.",
  ImageName: "character_a_ref"
)
```

Mark `[x]` in task.md. Move to next character.

#### Step 2: Generate Scene Reference Images (one per call)

```
generate_image(
  Prompt: "Environment background: [detailed description]. Wide establishing shot, atmospheric, no characters.",
  ImageName: "scene_1_ref"
)
```

Mark `[x]` in task.md. Move to next scene.

#### Step 3: Generate Comic Pages (one page per call)

```
task_boundary(TaskName: "Generating Page 1", ...)

generate_image(
  Prompt: "[Single page storyboard prompt from the approved draft]",
  ImageName: "comic_page_1",
  ImagePaths: ["/path/to/character_a_ref.png", "/path/to/scene_1_ref.png"]
)
```

After each page is generated:
1. Mark `[x]` in task.md
2. Use `notify_user` to show the result and ask the user if they want edits before moving on
3. Only proceed to the next page after user confirms

### Phase 3: Multi-Turn Editing (Per Page)

When user wants to edit a specific page, pass the previous version back via `ImagePaths`:

```
generate_image(
  Prompt: "Edit this comic page: [user's edit instruction]",
  ImageName: "comic_page_1_v2",
  ImagePaths: ["/path/to/comic_page_1.png"]
)
```

For scene/character reference changes, pass both the comic and the new reference:
```
generate_image(
  Prompt: "Edit this comic page: change the background to match the reference photo provided.",
  ImageName: "comic_page_1_v3",
  ImagePaths: ["/path/to/comic_page_1_v2.png", "/path/to/new_scene_ref.png"]
)
```

## Single Page Storyboard Prompt Format

Each page prompt should follow this structure (from `buildPageStoryboardPrompt` in `services/geminiService.ts`):

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
[Style preset suffix]

## IMPORTANT RULES
- Draw as a SINGLE comic page with panel borders/gutters
- CRITICAL: Match reference images exactly for characters
- Speech bubbles: round, tail to speaker, NO names inside
- SFX: OVERSIZED bold stylized text
- Keep bubble text short and legible
```

## Reading Project Data

The project at the workspace root contains:

| File | Data |
|------|------|
| `types.ts` | `ComicCharacter`, `ComicScene`, `ComicPageData` types |
| `services/geminiService.ts` | `buildPageStoryboardPrompt()` — prompt builder |
| `services/promptTemplates.ts` | Style presets, character/scene prompt templates |

## Style Presets

| Preset | Prompt Suffix |
|--------|--------------|
| Manga | Japanese manga style, black and white ink, screentone shading |
| Manhwa | Korean manhwa webtoon style, full color, clean digital art |
| Comic | American comic book style, bold outlines, vivid colors |
| Watercolor | Watercolor illustration, soft edges, gentle colors |
| Realistic | Realistic digital painting, cinematic lighting |

## Fallback: Direct API Scripts

For advanced use cases needing specific models, aspect ratios, or true multi-turn conversation history:

- `scripts/generate-comic-page.sh` — Direct Gemini API call with `--ref-image` support
- `scripts/edit-image.sh` — Multi-turn editing with full conversation history

These require the user's Gemini API Key (stored in `localStorage` key `comic_gemini_api_key` or ask user).
