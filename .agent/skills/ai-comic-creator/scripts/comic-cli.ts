import fs from 'node:fs/promises';
import path from 'node:path';
import {
    generateStoryboard,
    generateCharacterImage,
    generateSceneImage,
    generateFullPageImage
} from '../../../../services/geminiService';
import { ComicCharacter, ComicScene, ComicPageData } from '../../../../types';

// Polyfill for process.env.API_KEY if passed via GEMINI_API_KEY
if (process.env.GEMINI_API_KEY && !process.env.API_KEY) {
    process.env.API_KEY = process.env.GEMINI_API_KEY;
}

const apiKey = process.env.API_KEY;

function printUsage() {
    console.log(`
Comic Creator CLI
-----------------
Commands:
  storyboard <story.txt> <output.json>
      Generate a complete comic storyboard from a text story.
      
  characters <storyboard.json> <out-dir> [--style <preset>]
      Generate reference images for all characters without images in the storyboard.
      Updates the JSON file with base64 data and saves PNGs to out-dir.
      
  scenes <storyboard.json> <out-dir> [--style <preset>]
      Generate reference images for all scenes without images.
      
  pages <storyboard.json> <out-dir> [--style <preset>]
      Generate the final comic pages using the layout and reference images.
      
  run-all <story.txt> <out-dir> [--style <preset>]
      Run the entire pipeline continuously (story -> refs -> pages).
      
Options:
  --style <preset>   Style preset to use (e.g. manga, manhwa, comic, realistic). Default: manga
`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        printUsage();
        process.exit(1);
    }

    const command = args[0];

    // Parse style explicitly
    let stylePreset: any = 'manga';
    const styleIdx = args.indexOf('--style');
    if (styleIdx !== -1 && args.length > styleIdx + 1) {
        stylePreset = args[styleIdx + 1];
    }

    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY environment variable is missing.");
        process.exit(1);
    }

    try {
        if (command === 'storyboard') {
            const inputFile = args[1];
            const outputFile = args[2];
            if (!inputFile || !outputFile) throw new Error("Missing arguments for storyboard");

            console.log(`[1] Reading story from ${inputFile}...`);
            const story = await fs.readFile(path.resolve(inputFile), 'utf-8');

            console.log(`[2] Generating structured storyboard (Characters, Scenes, Pages)...`);
            const storyboard = await generateStoryboard(story, apiKey, 'gemini-2.5-flash');

            await fs.writeFile(path.resolve(outputFile), JSON.stringify(storyboard, null, 2));
            console.log(`✅ Storyboard saved to ${outputFile}`);
        }
        else if (command === 'characters') {
            const jsonFile = args[1];
            const outDir = args[2];
            if (!jsonFile || !outDir) throw new Error("Missing arguments for characters");

            await fs.mkdir(path.resolve(outDir), { recursive: true });
            const data = JSON.parse(await fs.readFile(path.resolve(jsonFile), 'utf-8'));

            for (const char of data.characters as ComicCharacter[]) {
                if (char.imageBase64) {
                    console.log(`Skipping character '${char.name}', image already exists.`);
                    continue;
                }
                console.log(`Generating image for character: ${char.name}...`);
                const base64 = await generateCharacterImage(char, stylePreset, '', 'gemini-2.0-flash-exp', apiKey);
                char.imageBase64 = base64;

                const charPath = path.resolve(outDir, `char_${char.id}.png`);
                await fs.writeFile(charPath, Buffer.from(base64, 'base64'));
                console.log(`✅ Saved ${charPath}`);
            }

            await fs.writeFile(path.resolve(jsonFile), JSON.stringify(data, null, 2));
            console.log(`✅ Updated ${jsonFile} with character image data.`);
        }
        else if (command === 'scenes') {
            const jsonFile = args[1];
            const outDir = args[2];
            if (!jsonFile || !outDir) throw new Error("Missing arguments for scenes");

            await fs.mkdir(path.resolve(outDir), { recursive: true });
            const data = JSON.parse(await fs.readFile(path.resolve(jsonFile), 'utf-8'));

            for (const scene of data.scenes as ComicScene[]) {
                if (scene.imageBase64) {
                    console.log(`Skipping scene '${scene.name}', image already exists.`);
                    continue;
                }
                console.log(`Generating image for scene: ${scene.name}...`);
                const base64 = await generateSceneImage(scene, stylePreset, '', 'gemini-2.0-flash-exp', apiKey);
                scene.imageBase64 = base64;

                const scenePath = path.resolve(outDir, `scene_${scene.id}.png`);
                await fs.writeFile(scenePath, Buffer.from(base64, 'base64'));
                console.log(`✅ Saved ${scenePath}`);
            }

            await fs.writeFile(path.resolve(jsonFile), JSON.stringify(data, null, 2));
            console.log(`✅ Updated ${jsonFile} with scene image data.`);
        }
        else if (command === 'pages') {
            const jsonFile = args[1];
            const outDir = args[2];
            if (!jsonFile || !outDir) throw new Error("Missing arguments for pages");

            await fs.mkdir(path.resolve(outDir), { recursive: true });
            const data = JSON.parse(await fs.readFile(path.resolve(jsonFile), 'utf-8'));

            for (let i = 0; i < data.pages.length; i++) {
                const page = data.pages[i] as ComicPageData;
                console.log(`Generating Comic Page ${i + 1}...`);
                const base64 = await generateFullPageImage(
                    page,
                    data.characters,
                    data.scenes,
                    stylePreset,
                    '',
                    'gemini-3.1-flash-image-preview',
                    apiKey,
                    (page as any).customPrompt // if user edited it manually via JSON
                );

                const pagePath = path.resolve(outDir, `page_${i + 1}.png`);
                await fs.writeFile(pagePath, Buffer.from(base64, 'base64'));
                console.log(`✅ Saved ${pagePath}`);
            }
        }
        else if (command === 'run-all') {
            const inputFile = args[1];
            const outDir = args[2];
            if (!inputFile || !outDir) throw new Error("Missing arguments for run-all");

            await fs.mkdir(path.resolve(outDir), { recursive: true });
            const jsonFile = path.resolve(outDir, 'storyboard.json');

            // 1. Storyboard
            console.log(`\n=== STEP 1: Storyboard Generation ===`);
            const story = await fs.readFile(path.resolve(inputFile), 'utf-8');
            const storyboard = await generateStoryboard(story, apiKey, 'gemini-2.5-flash');
            await fs.writeFile(jsonFile, JSON.stringify(storyboard, null, 2));
            console.log(`✅ Storyboard saved to ${jsonFile}`);

            // 2. Characters
            console.log(`\n=== STEP 2: Character Reference Images ===`);
            for (const char of storyboard.characters) {
                console.log(`Generating character: ${char.name}...`);
                const base64 = await generateCharacterImage(char, stylePreset, '', 'gemini-2.0-flash-exp', apiKey);
                char.imageBase64 = base64;
                await fs.writeFile(path.resolve(outDir, `char_${char.id}.png`), Buffer.from(base64, 'base64'));
            }

            // 3. Scenes
            console.log(`\n=== STEP 3: Scene Background Images ===`);
            for (const scene of storyboard.scenes) {
                console.log(`Generating scene: ${scene.name}...`);
                const base64 = await generateSceneImage(scene, stylePreset, '', 'gemini-2.0-flash-exp', apiKey);
                scene.imageBase64 = base64;
                await fs.writeFile(path.resolve(outDir, `scene_${scene.id}.png`), Buffer.from(base64, 'base64'));
            }

            await fs.writeFile(jsonFile, JSON.stringify(storyboard, null, 2));

            // 4. Pages
            console.log(`\n=== STEP 4: Comic Page Compilation ===`);
            for (let i = 0; i < storyboard.pages.length; i++) {
                console.log(`Generating Comic Page ${i + 1}...`);
                const base64 = await generateFullPageImage(
                    storyboard.pages[i],
                    storyboard.characters,
                    storyboard.scenes,
                    stylePreset,
                    '',
                    'gemini-3.1-flash-image-preview',
                    apiKey
                );
                await fs.writeFile(path.resolve(outDir, `page_${i + 1}.png`), Buffer.from(base64, 'base64'));
            }

            console.log(`\n🎉 Pipeline Complete! Check ${outDir} for all resources.`);
        }
        else {
            console.error(`Unknown command: ${command}`);
            printUsage();
            process.exit(1);
        }

    } catch (e: any) {
        console.error("FATAL ERROR:", e.message);
        process.exit(1);
    }
}

main();
