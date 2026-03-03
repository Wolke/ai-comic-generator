// ============ Core Types for AI Comic Generator ============

// Page navigation
export type AppPage = 'studio' | 'reader' | 'config';

// ============ Gemini Model Selection ============
export const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
] as const;
export type GeminiModel = typeof GEMINI_MODELS[number];

export const GEMINI_IMAGE_MODELS = [
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
] as const;
export type GeminiImageModel = typeof GEMINI_IMAGE_MODELS[number];

// ============ Image Style ============
export type ImageStylePreset = 'manga' | 'manhwa' | 'comic' | 'watercolor' | 'realistic' | 'custom';

export const IMAGE_STYLE_PRESETS: { value: ImageStylePreset; label: string; promptSuffix: string }[] = [
    { value: 'manga', label: '日式漫畫 (Manga)', promptSuffix: 'Japanese manga style, black and white ink, screentone shading, dynamic panel composition, detailed linework' },
    { value: 'manhwa', label: '韓式漫畫 (Manhwa)', promptSuffix: 'Korean manhwa webtoon style, full color, clean digital art, soft shading, vibrant colors' },
    { value: 'comic', label: '美式漫畫 (Comic)', promptSuffix: 'American comic book style, bold outlines, vivid colors, dynamic shadows, Ben-Day dots' },
    { value: 'watercolor', label: '水彩風格', promptSuffix: 'watercolor illustration style, soft edges, transparent layers, artistic, gentle colors' },
    { value: 'realistic', label: '寫實風格', promptSuffix: 'realistic digital painting, detailed, cinematic lighting, photorealistic rendering' },
    { value: 'custom', label: '自訂風格', promptSuffix: '' },
];

// ============ Panel Layout ============
export type PanelType = 'normal' | 'wide' | 'tall' | 'splash';
export type PageLayout = 'grid-2x2' | 'grid-2x3' | 'grid-3x2' | 'top-wide' | 'bottom-wide' | 'splash' | 'auto';

// ============ Comic Character ============
export interface ComicCharacter {
    id: string;
    name: string;
    description: string;       // Physical appearance description (AI-generated)
    imagePrompt: string;        // Anonymized image generation prompt
    imageBase64?: string;        // Character reference sheet
    isGeneratingImage?: boolean;
}

// ============ Comic Scene ============
export interface ComicScene {
    id: string;
    name: string;
    visualDescription: string;  // Detailed scene description (English)
    imageBase64?: string;        // Scene reference image
    isGeneratingImage?: boolean;
}

// ============ Panel Dialogue ============
export interface PanelDialogue {
    character: string;           // Character name
    text: string;                // Dialogue text (in story language)
    type: 'speech' | 'thought' | 'narration' | 'sfx';
}

// ============ Comic Panel ============
export interface ComicPanel {
    id: string;
    pageIndex: number;
    panelIndex: number;
    sceneRef: string;            // Scene name reference
    sceneCharacters: string[];   // Characters present (order = Character A, B...)
    imagePrompt: string;         // Anonymized visual description
    dialogues: PanelDialogue[];
    panelType: PanelType;
    imageBase64?: string;        // Generated panel image
    isGeneratingImage?: boolean;
}

// ============ Comic Page ============
export interface ComicPageData {
    pageIndex: number;
    panels: ComicPanel[];
    layout: PageLayout;
    pageImageBase64?: string;    // Generated full-page comic image
}

// ============ Generated Comic Info ============
export interface GeneratedComicInfo {
    title: string;
    author: string;
    synopsis: string;
    coverPrompt: string;
    tags: string[];
}

// ============ App State ============
export interface ComicState {
    // Story
    storyText: string;

    // Generated data
    characters: ComicCharacter[];
    scenes: ComicScene[];
    pages: ComicPageData[];
    comicInfo: GeneratedComicInfo | null;

    // Generation state
    isGeneratingStoryboard: boolean;

    // Configuration
    geminiApiKey: string;
    geminiModel: GeminiModel;
    imageModel: GeminiImageModel;
    imageStylePreset: ImageStylePreset;
    customImageStyle: string;
}
