/**
 * Gemini Service for AI Comic Generator
 * 
 * Handles:
 * - Storyboard generation (structured output with prompt isolation)
 * - Character/scene image generation
 * - Composite panel image generation (character refs + scene ref + action prompt)
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
    ComicCharacter, ComicScene, ComicPanel, ComicPageData,
    PanelDialogue, GeneratedComicInfo,
    ImageStylePreset, GeminiImageModel,
} from "../types";
import {
    buildStoryboardPrompt,
    getCharacterImagePrompt,
    getSceneImagePrompt,
    getImageStyleSuffix,
} from "./promptTemplates";

// ============ Gemini Client ============

let cachedAI: GoogleGenAI | null = null;
let cachedKey: string = '';

const getAI = (apiKey?: string): GoogleGenAI => {
    const key = apiKey || process.env.API_KEY || '';
    if (!key) throw new Error("Gemini API Key is required.");
    if (cachedAI && cachedKey === key) return cachedAI;
    cachedAI = new GoogleGenAI({ apiKey: key });
    cachedKey = key;
    return cachedAI;
};

// ============ Storyboard Generation ============

interface GeneratedStoryboard {
    characters: ComicCharacter[];
    scenes: ComicScene[];
    pages: ComicPageData[];
    comicInfo: GeneratedComicInfo | null;
}

/**
 * Generate a complete comic storyboard from a story text.
 * Uses Gemini structured output to enforce JSON format.
 * Implements prompt isolation: imagePrompt uses "Character A/B" anonymization.
 */
export const generateStoryboard = async (
    story: string,
    apiKey?: string,
    model: string = 'gemini-2.5-flash'
): Promise<GeneratedStoryboard> => {
    if (!story.trim()) return { characters: [], scenes: [], pages: [], comicInfo: null };

    const ai = getAI(apiKey);
    const prompt = buildStoryboardPrompt(story);

    console.log("--- [Gemini] Generate Storyboard Prompt ---");
    console.log(prompt);
    console.log("-------------------------------------------");

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING, description: "Detailed physical appearance in English" },
                                    imagePrompt: { type: Type.STRING, description: "Standalone character portrait prompt in English" },
                                },
                                required: ["name", "description", "imagePrompt"]
                            }
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    visualDescription: { type: Type.STRING, description: "Detailed environment description in English" },
                                },
                                required: ["name", "visualDescription"]
                            }
                        },
                        pages: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    panels: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                sceneRef: { type: Type.STRING, description: "Scene name reference" },
                                                panelType: { type: Type.STRING, enum: ['normal', 'wide', 'tall', 'splash'] },
                                                sceneCharacters: {
                                                    type: Type.ARRAY,
                                                    items: { type: Type.STRING },
                                                    description: "Character names present. ORDER MATTERS: 1st = Character A, 2nd = Character B."
                                                },
                                                imagePrompt: {
                                                    type: Type.STRING,
                                                    description: "Visual scene description. Use 'Character A' for 1st in sceneCharacters, 'Character B' for 2nd. Use 'The Scene' for location. Do NOT use real character/location names."
                                                },
                                                dialogues: {
                                                    type: Type.ARRAY,
                                                    items: {
                                                        type: Type.OBJECT,
                                                        properties: {
                                                            character: { type: Type.STRING },
                                                            text: { type: Type.STRING },
                                                            type: { type: Type.STRING, enum: ['speech', 'thought', 'narration', 'sfx'] },
                                                        },
                                                        required: ["character", "text", "type"]
                                                    }
                                                }
                                            },
                                            required: ["sceneRef", "panelType", "sceneCharacters", "imagePrompt", "dialogues"]
                                        }
                                    }
                                },
                                required: ["panels"]
                            }
                        },
                        comicInfo: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                author: { type: Type.STRING },
                                synopsis: { type: Type.STRING },
                                coverPrompt: { type: Type.STRING, description: "Detailed cover art prompt in English" },
                                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ["title", "synopsis", "coverPrompt"]
                        }
                    },
                    required: ["characters", "scenes", "pages", "comicInfo"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from Gemini");

        const data = JSON.parse(text);
        console.log("[Gemini] Storyboard parsed successfully:", {
            characters: data.characters?.length,
            scenes: data.scenes?.length,
            pages: data.pages?.length,
        });

        // Transform into our types
        const characters: ComicCharacter[] = (data.characters || []).map((c: any, i: number) => ({
            id: `char-${i}`,
            name: c.name,
            description: c.description || '',
            imagePrompt: c.imagePrompt || '',
        }));

        const scenes: ComicScene[] = (data.scenes || []).map((s: any, i: number) => ({
            id: `scene-${i}`,
            name: s.name,
            visualDescription: s.visualDescription || '',
        }));

        const pages: ComicPageData[] = (data.pages || []).map((page: any, pageIdx: number) => ({
            pageIndex: pageIdx,
            layout: 'auto' as const,
            panels: (page.panels || []).map((panel: any, panelIdx: number) => ({
                id: `p${pageIdx}-${panelIdx}`,
                pageIndex: pageIdx,
                panelIndex: panelIdx,
                sceneRef: panel.sceneRef || '',
                sceneCharacters: panel.sceneCharacters || [],
                imagePrompt: panel.imagePrompt || '',
                dialogues: (panel.dialogues || []).map((d: any) => ({
                    character: d.character || '',
                    text: d.text || '',
                    type: d.type || 'speech',
                })),
                panelType: panel.panelType || 'normal',
            })),
        }));

        const comicInfo: GeneratedComicInfo | null = data.comicInfo ? {
            title: data.comicInfo.title || 'Untitled',
            author: data.comicInfo.author || 'AI Generated',
            synopsis: data.comicInfo.synopsis || '',
            coverPrompt: data.comicInfo.coverPrompt || '',
            tags: data.comicInfo.tags || [],
        } : null;

        return { characters, scenes, pages, comicInfo };
    } catch (error) {
        console.error("[Gemini] Storyboard generation error:", error);
        throw error;
    }
};

// ============ Image Generation ============

/**
 * Generate image using Gemini's image generation model
 */
export const generateImage = async (
    prompt: string,
    aspectRatio: string = '3:4',
    model: string = 'gemini-2.0-flash-exp',
    apiKey?: string
): Promise<string> => {
    const key = apiKey || process.env.API_KEY || '';
    if (!key) throw new Error("Gemini API Key is required for image generation.");

    console.log("--- [Gemini] Generate Image ---");
    console.log("Prompt:", prompt.slice(0, 200) + "...");
    console.log("Model:", model);
    console.log("-------------------------------");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio },
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image generation failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
        throw new Error('No image generated.');
    }

    return imagePart.inlineData.data;
};

/**
 * Generate character reference image
 */
export const generateCharacterImage = async (
    character: ComicCharacter,
    stylePreset: ImageStylePreset,
    customStyle: string,
    imageModel: string,
    apiKey?: string
): Promise<string> => {
    const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
    const prompt = getCharacterImagePrompt(character, styleSuffix);
    return generateImage(prompt, '3:4', imageModel, apiKey);
};

/**
 * Generate scene background image
 */
export const generateSceneImage = async (
    scene: ComicScene,
    stylePreset: ImageStylePreset,
    customStyle: string,
    imageModel: string,
    apiKey?: string
): Promise<string> => {
    const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
    const prompt = getSceneImagePrompt(scene, styleSuffix);
    return generateImage(prompt, '16:9', imageModel, apiKey);
};

// ============ Full Page Comic Image Generation ============

interface CharacterRef {
    name: string;
    imageBase64: string;
}

/**
 * Build a markdown-style storyboard description for one comic page.
 * This describes all panels, their layout, dialogues, and character actions
 * so the image model can generate a complete comic page in one shot.
 */
export const buildPageStoryboardPrompt = (
    page: ComicPageData,
    characters: ComicCharacter[],
    scenes: ComicScene[],
    stylePreset: ImageStylePreset,
    customStyle: string,
): string => {
    const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
    const panelCount = page.panels.length;

    let prompt = `Generate a COMPLETE comic/manga page with ${panelCount} panel(s).\n\n`;

    // Build global character mapping (anonymized → real name)
    // Collect all unique character appearances across panels
    const globalCharMap = new Map<string, string[]>(); // charName → list of panels where they appear
    page.panels.forEach((panel, idx) => {
        panel.sceneCharacters.forEach((charName, charIdx) => {
            const label = String.fromCharCode(65 + charIdx); // A, B, C...
            if (!globalCharMap.has(charName)) {
                globalCharMap.set(charName, []);
            }
        });
    });

    // Add character identity section so the model knows who is who
    if (globalCharMap.size > 0) {
        prompt += `## CHARACTER IDENTITY\n`;
        prompt += `The following characters appear in this page. When the panel descriptions say "Character A", "Character B", etc., refer to the mapping below and USE THE PROVIDED REFERENCE IMAGES for their appearance:\n`;
        const allChars = Array.from(globalCharMap.keys());
        allChars.forEach((charName) => {
            const char = characters.find(c => c.name === charName);
            const hasImage = !!char?.imageBase64;
            prompt += `- **${charName}**${hasImage ? ' (reference image provided — MUST match this appearance)' : ''}\n`;
        });
        prompt += '\n';
    }

    // Describe each panel
    prompt += `## PAGE LAYOUT (${panelCount} panels)\n\n`;

    page.panels.forEach((panel, idx) => {
        const panelNum = idx + 1;
        const typeHint = {
            normal: 'Standard panel',
            wide: 'Wide/landscape panel (full width)',
            tall: 'Tall/vertical panel',
            splash: 'Splash panel (large, dramatic)',
        }[panel.panelType];

        prompt += `### Panel ${panelNum} [${typeHint}]\n`;

        // Add character mapping for this panel
        if (panel.sceneCharacters.length > 0) {
            const mapping = panel.sceneCharacters
                .map((name, i) => `Character ${String.fromCharCode(65 + i)} = ${name}`)
                .join(', ');
            prompt += `**Characters**: ${mapping}\n`;
        }

        prompt += `**Visual**: ${panel.imagePrompt}\n`;

        // Add dialogues as speech bubbles
        if (panel.dialogues.length > 0) {
            prompt += `**Dialogue bubbles**:\n`;
            panel.dialogues.forEach(d => {
                if (d.type === 'sfx') {
                    prompt += `  💥 SFX: ${d.text}  (render as LARGE bold stylized text overlaying the panel)\n`;
                } else if (d.type === 'narration') {
                    prompt += `  📝 [caption box]: "${d.text}"\n`;
                } else {
                    const bubbleIcon = d.type === 'thought' ? '💭' : '💬';
                    prompt += `  ${bubbleIcon} [bubble tail → ${d.character}]: "${d.text}"\n`;
                }
            });
        }
        prompt += '\n';
    });

    prompt += `## STYLE\n${styleSuffix}\n\n`;

    prompt += `## IMPORTANT RULES\n`;
    prompt += `- Draw this as a SINGLE comic page with clear panel borders/gutters\n`;
    prompt += `- **CRITICAL**: If reference images are provided, characters MUST visually match those reference images exactly. Do NOT invent new character designs.\n`;
    prompt += `- Speech bubbles (💬): round shape with a tail pointing to the speaker. Contains ONLY the dialogue text, NO character names inside the bubble.\n`;
    prompt += `- Thought bubbles (💭): cloud-shaped, tail pointing to thinker. Text only, no names.\n`;
    prompt += `- Narration (📝): rectangular caption boxes, no character names.\n`;
    prompt += `- Sound effects (💥): render as OVERSIZED, bold, stylized characters that dramatically overlay or break panel borders. Like manga onomatopoeia. The SFX text should be the dominant visual element.\n`;
    prompt += `- NEVER write character names inside any bubble or caption box.\n`;
    prompt += `- Keep text in bubbles short and legible. If text is too long, use a larger bubble.\n`;
    prompt += `- Reading order: left-to-right, top-to-bottom\n`;
    prompt += `- Panel layout should feel dynamic, not a rigid grid\n`;
    prompt += `- Maintain consistent character appearances across all panels\n`;

    return prompt;
};

/**
 * Generate a complete comic page image.
 * Takes all panels on a page + character/scene reference images,
 * and generates one full-page comic image with panels, dialogues, and layout.
 */
export const generateFullPageImage = async (
    page: ComicPageData,
    characters: ComicCharacter[],
    scenes: ComicScene[],
    stylePreset: ImageStylePreset,
    customStyle: string,
    model: string = 'gemini-2.5-flash-image',
    apiKey?: string,
    customPrompt?: string, // Optional: user-edited prompt overrides auto-generated one
): Promise<string> => {
    const key = apiKey || process.env.API_KEY || '';
    if (!key) throw new Error("Gemini API Key is required for image generation.");

    const storyboardPrompt = customPrompt || buildPageStoryboardPrompt(page, characters, scenes, stylePreset, customStyle);

    // Collect all unique character refs and scene refs for this page
    const parts: any[] = [];
    const addedCharRefs = new Set<string>();
    const addedSceneRefs = new Set<string>();
    const refLabels: string[] = [];

    // Gather character images used on this page
    for (const panel of page.panels) {
        for (const charName of panel.sceneCharacters) {
            if (addedCharRefs.has(charName)) continue;
            const char = characters.find(c => c.name === charName);
            if (char?.imageBase64) {
                addedCharRefs.add(charName);
                // Include text description based on useTextDescription toggle
                const useText = char.useTextDescription !== false; // default true
                if (useText) {
                    refLabels.push(`Character "${charName}" — ${char.description}`);
                } else {
                    refLabels.push(`Character "${charName}" (use image reference only, ignore text description)`);
                }
            }
        }
        // Gather scene images used on this page
        if (panel.sceneRef && !addedSceneRefs.has(panel.sceneRef)) {
            const scene = scenes.find(s => s.name === panel.sceneRef);
            if (scene?.imageBase64) {
                addedSceneRefs.add(panel.sceneRef);
                const useText = scene.useTextDescription !== false; // default true
                if (useText) {
                    refLabels.push(`Scene "${panel.sceneRef}" — ${scene.visualDescription}`);
                } else {
                    refLabels.push(`Scene "${panel.sceneRef}" (use image reference only, ignore text description)`);
                }
            }
        }
    }

    // Build reference instruction
    let textPrompt = '';
    if (refLabels.length > 0) {
        textPrompt += `## REFERENCE IMAGES\nThe following reference images are provided. Use these for consistent character appearances and scene backgrounds:\n`;
        refLabels.forEach((label, i) => {
            textPrompt += `- Image ${i + 1}: ${label}\n`;
        });
        textPrompt += '\n';
    }
    textPrompt += storyboardPrompt;

    parts.push({ text: textPrompt });

    // Add character inline images
    for (const charName of addedCharRefs) {
        const char = characters.find(c => c.name === charName);
        if (char?.imageBase64) {
            parts.push({
                inlineData: { mimeType: "image/png", data: char.imageBase64 }
            });
        }
    }

    // Add scene inline images
    for (const sceneName of addedSceneRefs) {
        const scene = scenes.find(s => s.name === sceneName);
        if (scene?.imageBase64) {
            parts.push({
                inlineData: { mimeType: "image/png", data: scene.imageBase64 }
            });
        }
    }

    console.log("--- [Gemini] Generate Full Page Image ---");
    console.log("Panels:", page.panels.length);
    console.log("Character refs:", addedCharRefs.size);
    console.log("Scene refs:", addedSceneRefs.size);
    console.log("Storyboard prompt:", textPrompt.slice(0, 300) + "...");
    console.log("-----------------------------------------");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const body = {
        contents: [{ parts }],
        generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: '3:4' },
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Full page image generation failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
        throw new Error('No page image generated.');
    }

    return imagePart.inlineData.data;
};
