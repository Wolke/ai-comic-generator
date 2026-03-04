---
name: AI Comic Creator Pipeline
description: A conversational comic creation pipeline that leverages the project's internal TypeScript services to generate storyboards, reference images, and final comic pages.
---

# AI Comic Creator Pipeline Skill

This skill allows you (Antigravity) to act as a complete **Comic Studio Assistant**. Instead of just wrapping raw Gemini API endpoints, this skill calls the project's actual domain logic (`services/geminiService.ts`) via a CLI. 

This means it perfectly replicates the Web App's behavior (structured output, prompt isolation, reference mapping) directly in your chat interface!

## Prerequisites

- The project must have `tsx` installed (`npm i -D tsx` was already executed).
- The `GEMINI_API_KEY` environment variable must be set.
- The script is located at: `.agent/skills/ai-comic-creator/scripts/comic-cli.ts`
- Use `npx tsx` to run the script.

## The Conversational Workflow

As the AI assistant, you should guide the user through this multi-step process step-by-step, allowing them to intervene and edit at each stage.

### Step 1: Storyboard Generation

When the user provides a story idea (e.g., "寫一個貓咪的冒險故事"):

1. Save their story to a temporary text file.
2. Run the `storyboard` command:
```bash
npx tsx .agent/skills/ai-comic-creator/scripts/comic-cli.ts storyboard /tmp/story.txt /tmp/comic/storyboard.json
```
3. Read the output JSON. **Summarize** the characters, scenes, and pages generated for the user in the chat.
4. Ask the user: "你想直接開始生成角色與場景圖片，還是想先修改 `storyboard.json` 裡面的角色描述/分鏡說明？"

### Step 2: Reference Image Generation

Once the user approves or edits the storyboard:

1. Run the `characters` and `scenes` commands:
```bash
npx tsx .agent/skills/ai-comic-creator/scripts/comic-cli.ts characters /tmp/comic/storyboard.json /tmp/comic/
npx tsx .agent/skills/ai-comic-creator/scripts/comic-cli.ts scenes /tmp/comic/storyboard.json /tmp/comic/
```
*(You can append `--style manga` or other presets from types.ts to the command)*

2. This will save `char_*.png` and `scene_*.png` in `/tmp/comic/` and embed their base64 inside the JSON automatically.
3. Use the `view_file` tool to display these reference PNGs to the user in the chat!
4. Ask: "這些角色與場景風格滿意嗎？如果覺得 OK，我們就開始生成最終漫畫頁面！"
*(If they aren't satisfied, you can edit the JSON description and run the command again, it only generates images for characters without `imageBase64`).*

### Step 3: Comic Page Compilation

Once reference images are finalized:

1. Run the `pages` command:
```bash
npx tsx .agent/skills/ai-comic-creator/scripts/comic-cli.ts pages /tmp/comic/storyboard.json /tmp/comic/
```
2. The engine will merge the storyboard layout and reference images, generating `page_1.png`, `page_2.png`.
3. Show these magnificent final comic pages to the user!

## Power Mode: Run All

If the user just says "幫我一鍵生成一篇關於忍者狗的短篇漫畫", and doesn't want to be bothered with intermediate steps, you can run the entire pipeline at once:

```bash
npx tsx .agent/skills/ai-comic-creator/scripts/comic-cli.ts run-all /tmp/story.txt /tmp/comic/ --style manga
```

## Why this is better than a generic Image Skill
1. **Consistency**: It uses the exact same `geminiService.ts` code as the Web App. The prompts, styles, and data structures are 100% synchronized.
2. **Context**: The AI knows *who* Character A is, *what* they look like, and passes this context seamlessly to Gemini 3.1 Pro because the project's codebase already handles prompt isolation.
3. **Editable State**: By writing `storyboard.json` to disk between steps, the user or you (the Agent) can intercept and tweak descriptions before spending time/money on image generation.
