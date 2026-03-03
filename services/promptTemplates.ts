/**
 * Prompt Templates for Comic Storyboard Generation
 * 
 * Core design pattern from radio-drama-2:
 * - Modular, composable prompt functions
 * - Prompt isolation: imagePrompt uses "Character A/B" instead of real names
 * - Gemini structured output schema enforces output format
 */

import { ImageStylePreset, IMAGE_STYLE_PRESETS } from '../types';

// ============ Language Detection ============

export const getLanguageInstructions = (): string => {
  return `**CRITICAL LANGUAGE INSTRUCTION**: 
- **FIRST**: Detect the language of the input story (English, Chinese, Japanese, etc.)
- **Dialogue text MUST be in the SAME LANGUAGE as the input story.**
  - If the story is in English → ALL dialogue MUST be in English
  - If the story is in Chinese → ALL dialogue MUST be in Chinese
  - NEVER translate the story content to a different language
- The 'description', 'visualDescription', 'imagePrompt', and 'expression' fields MUST ALWAYS be in ENGLISH.`;
};

// ============ Character Instructions ============

export const getCharacterInstructions = (): string => {
  return `1. **Characters**: Identify all characters from the story.
   - 'name': The character's name (in the story's language).
   - 'description' (ENGLISH): Detailed physical appearance — age, build, hair, clothing, distinguishing features. 
     This will be used as reference for consistent image generation across all panels.
     Be VERY specific and detailed. Example: "A tall man in his 30s with messy black hair, sharp jawline, wearing a dark blue trench coat over a white shirt, has a small scar above his left eyebrow."
   - 'imagePrompt' (ENGLISH): A standalone character portrait prompt suitable for AI image generation. 
     Example: "Full body character portrait of a tall man in his 30s, messy black hair, sharp jawline, dark blue trench coat over white shirt, small scar above left eyebrow. Character concept art, clean white background."`;
};

// ============ Scene Instructions ============

export const getSceneInstructions = (): string => {
  return `2. **Scenes**: Identify the key locations/environments in the story.
   - 'name': Short name for the location (e.g., "Coffee Shop", "Dark Alley").
   - 'visualDescription' (ENGLISH): Detailed atmospheric description of the environment. 
     Include lighting, mood, key objects, architecture, weather, time of day.
     Example: "A cozy corner coffee shop with warm amber lighting, exposed brick walls, wooden tables with mismatched chairs, a large window showing a rainy cityscape outside, steam rising from cups."`;
};

// ============ Panel / Storyboard Instructions ============

export const getPanelInstructions = (): string => {
  return `3. **Pages & Panels**: Break the story into comic pages, each with 3-6 panels.
   - Each page represents a logical story beat or scene transition.
   - Each panel is a single visual moment / frame.
   
   For each panel:
   - 'sceneRef': Name of the scene/location (must match a scene name from the Scenes list).
   - 'panelType': One of 'normal', 'wide', 'tall', 'splash'.
     - 'splash': Full-page dramatic moment (use sparingly, max 1 per page).
     - 'wide': Landscape establishing shot or panoramic view.
     - 'tall': Vertical emphasis, character close-up, dramatic reveal.
     - 'normal': Standard panel.
   - 'sceneCharacters': Array of character names present in this panel moment.
     **ORDER MATTERS**: The first name is "Character A", the second is "Character B", etc.
   - 'imagePrompt' (ENGLISH): Visual description of what happens in this panel.
     **CRITICAL ANONYMIZATION RULES**:
     - Refer to the FIRST character in 'sceneCharacters' as "Character A"
     - Refer to the SECOND character as "Character B", and so on.
     - Refer to the location as "The Scene"
     - Do NOT use any real character names or location names in imagePrompt!
     - Describe the action, camera angle, composition, and mood.
     Example: "Medium shot. Character A sits across from Character B at a table in The Scene. Character A leans forward with an intense expression, pointing at a document. Character B looks away nervously. Dramatic lighting from the window."
   - 'dialogues': Array of dialogue bubbles for this panel.
     - 'character': The character's real name (used to determine bubble tail direction, NOT displayed in bubble).
     - 'text': The dialogue text only (in the story's language).
       **CRITICAL DIALOGUE RULES**:
       - Do NOT include character names in the text. Readers know who is speaking from the bubble tail direction.
       - Each 'text' must be SHORT: maximum 20 characters. If a character says more, split into multiple dialogue entries.
       - Example: Instead of one long 50-char line, split into 2-3 separate dialogue entries for the same character.
     - 'type': 'speech' | 'thought' | 'narration' | 'sfx'.
       **SFX RULES**:
       - For 'sfx' type, 'text' must be exactly 1-2 large onomatopoeia characters (e.g., '吼', '碰', '轟', '嘭', 'BOOM').
       - Do NOT wrap SFX in parentheses or add descriptions like '(大吼)'. Just the sound character itself.`;
};

// ============ Comic Info Instructions ============

export const getComicInfoInstructions = (): string => {
  return `4. **Comic Info**: Generate metadata for the comic.
   - 'title': Comic title (in the story's language).
   - 'author': Author attribution (e.g., "AI Generated").
   - 'synopsis': 2-3 sentence synopsis (in the story's language).
   - 'coverPrompt' (ENGLISH): Detailed prompt for generating the comic cover art. Include visual style, key characters, mood, and composition.
   - 'tags': Array of 3-5 tags in English for categorization.`;
};

// ============ System Prompt ============

export const getSystemPrompt = (): string => {
  return `You are an expert comic/manga storyboard artist and scriptwriter.
Convert stories into detailed comic storyboards with character designs, scene descriptions, panel-by-panel breakdowns, and dialogue.

You must create visually compelling, well-paced comic panels that tell the story effectively through sequential art.`;
};

// ============ Full Prompt Builder ============

export const buildStoryboardPrompt = (story: string): string => {
  return `${getSystemPrompt()}

Convert the following story into a detailed comic storyboard.

${getLanguageInstructions()}

**INSTRUCTIONS**:
${getCharacterInstructions()}

${getSceneInstructions()}

${getPanelInstructions()}

${getComicInfoInstructions()}

**PACING GUIDELINES**:
- Aim for 4-8 pages depending on story length.
- Each page should have 3-6 panels.
- Use 'splash' panels sparingly for dramatic moments.
- Start with an establishing shot ('wide' panel).
- End with a strong closing panel.
- Balance dialogue-heavy panels with action/visual panels.

Story:
"${story}"`;
};

// ============ Image Generation Prompts ============

/**
 * Generate character portrait prompt
 */
export const getCharacterImagePrompt = (
  character: { name: string; description: string; imagePrompt?: string },
  styleSuffix: string
): string => {
  const basePrompt = character.imagePrompt ||
    `Full body character portrait of ${character.description}`;

  return `${basePrompt}. ${styleSuffix}. Character concept art sheet, multiple angles, clean white background, no text, no letters.`;
};

/**
 * Generate scene background prompt
 */
export const getSceneImagePrompt = (
  scene: { name: string; visualDescription: string },
  styleSuffix: string
): string => {
  return `Environment background: ${scene.visualDescription}. ${styleSuffix}. Wide establishing shot, atmospheric, cinematic composition, no characters, no text, suitable for comic panel background.`;
};

/**
 * Get image style suffix from preset
 */
export const getImageStyleSuffix = (
  preset: ImageStylePreset,
  customStyle: string
): string => {
  if (preset === 'custom' && customStyle) {
    return customStyle;
  }
  const found = IMAGE_STYLE_PRESETS.find(p => p.value === preset);
  return found?.promptSuffix || 'high quality, detailed';
};
