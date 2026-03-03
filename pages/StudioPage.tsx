/**
 * StudioPage — Core editing page for comic storyboard
 * Story input → Generate storyboard → Characters / Scenes / Per-page comic generation
 *
 * State is managed by App.tsx (lifted up) so it persists when switching pages.
 */

import React, { useState } from 'react';
import {
    Wand2, Loader2, BookOpen, Users, Map, Image as ImageIcon,
    ChevronDown, ChevronRight, RefreshCw, Sparkles,
    MessageSquare, Eye, Zap, Upload, Share2, Trash2,
} from 'lucide-react';
import {
    ComicCharacter, ComicScene, ComicPageData, ComicPanel,
    GeneratedComicInfo, ImageStylePreset, GeminiImageModel,
} from '../types';
import {
    generateStoryboard,
    generateCharacterImage,
    generateSceneImage,
    generateFullPageImage,
    buildPageStoryboardPrompt,
} from '../services/geminiService';

interface StudioPageProps {
    geminiApiKey: string;
    geminiModel: string;
    imageModel: GeminiImageModel;
    imageStylePreset: ImageStylePreset;
    customImageStyle: string;
    // Lifted state
    storyText: string;
    setStoryText: (s: string) => void;
    characters: ComicCharacter[];
    setCharacters: React.Dispatch<React.SetStateAction<ComicCharacter[]>>;
    scenes: ComicScene[];
    setScenes: React.Dispatch<React.SetStateAction<ComicScene[]>>;
    pages: ComicPageData[];
    setPages: React.Dispatch<React.SetStateAction<ComicPageData[]>>;
    comicInfo: GeneratedComicInfo | null;
    setComicInfo: (info: GeneratedComicInfo | null) => void;
    // Lightbox & Share
    onImageClick: (base64: string, alt?: string) => void;
    onShare: (base64: string) => void;
    // Editable prompts
    editedPagePrompts: Record<number, string>;
    setEditedPagePrompts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

export const StudioPage: React.FC<StudioPageProps> = ({
    geminiApiKey, geminiModel, imageModel,
    imageStylePreset, customImageStyle,
    storyText, setStoryText,
    characters, setCharacters,
    scenes, setScenes,
    pages, setPages,
    comicInfo, setComicInfo,
    onImageClick, onShare,
    editedPagePrompts, setEditedPagePrompts,
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UI state
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['story', 'characters', 'scenes', 'pages'])
    );
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
    const [expandedPagePrompt, setExpandedPagePrompt] = useState<Set<number>>(new Set());

    const toggleSection = (section: string) => {
        const next = new Set(expandedSections);
        next.has(section) ? next.delete(section) : next.add(section);
        setExpandedSections(next);
    };

    const hasStoryboard = characters.length > 0 || pages.length > 0;

    // ============ Generate Storyboard ============
    const handleGenerate = async () => {
        if (!storyText.trim() || !geminiApiKey) {
            setError(!geminiApiKey ? '請先在設定頁面填入 Gemini API Key' : '請輸入故事內容');
            return;
        }
        setIsGenerating(true);
        setError(null);
        try {
            const result = await generateStoryboard(storyText, geminiApiKey, geminiModel);
            setCharacters(result.characters);
            setScenes(result.scenes);
            setPages(result.pages);
            setComicInfo(result.comicInfo);
        } catch (e: any) {
            setError(e.message || 'Failed to generate storyboard');
        } finally {
            setIsGenerating(false);
        }
    };

    // ============ Image Upload Helper ============
    const handleImageUpload = (file: File, callback: (base64: string) => void) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64 = result.split(',')[1];
            if (base64) callback(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleCharacterImageUpload = (charId: string, file: File) => {
        handleImageUpload(file, (base64) => {
            setCharacters(prev => prev.map(c =>
                c.id === charId ? { ...c, imageBase64: base64 } : c
            ));
        });
    };

    const handleSceneImageUpload = (sceneId: string, file: File) => {
        handleImageUpload(file, (base64) => {
            setScenes(prev => prev.map(s =>
                s.id === sceneId ? { ...s, imageBase64: base64 } : s
            ));
        });
    };

    // ============ Generate Character Image ============
    const handleGenerateCharacterImage = async (charId: string) => {
        const char = characters.find(c => c.id === charId);
        if (!char || !geminiApiKey) return;
        setGeneratingImageFor(`char:${charId}`);
        try {
            const base64 = await generateCharacterImage(char, imageStylePreset, customImageStyle, imageModel, geminiApiKey);
            setCharacters(prev => prev.map(c => c.id === charId ? { ...c, imageBase64: base64 } : c));
        } catch (e: any) {
            setError(`角色圖片生成失敗: ${e.message}`);
        } finally {
            setGeneratingImageFor(null);
        }
    };

    // ============ Generate Scene Image ============
    const handleGenerateSceneImage = async (sceneId: string) => {
        const scene = scenes.find(s => s.id === sceneId);
        if (!scene || !geminiApiKey) return;
        setGeneratingImageFor(`scene:${sceneId}`);
        try {
            const base64 = await generateSceneImage(scene, imageStylePreset, customImageStyle, imageModel, geminiApiKey);
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageBase64: base64 } : s));
        } catch (e: any) {
            setError(`場景圖片生成失敗: ${e.message}`);
        } finally {
            setGeneratingImageFor(null);
        }
    };

    // ============ Generate Full Page Image ============
    const handleGeneratePageImage = async (pageIdx: number) => {
        const page = pages[pageIdx];
        if (!page || !geminiApiKey) return;
        setGeneratingImageFor(`page:${pageIdx}`);
        try {
            const customPrompt = editedPagePrompts[pageIdx] || undefined;
            const base64 = await generateFullPageImage(
                page, characters, scenes,
                imageStylePreset, customImageStyle, imageModel, geminiApiKey,
                customPrompt,
            );
            setPages(prev => prev.map((p, i) =>
                i === pageIdx ? { ...p, pageImageBase64: base64 } : p
            ));
        } catch (e: any) {
            setError(`頁面圖片生成失敗: ${e.message}`);
        } finally {
            setGeneratingImageFor(null);
        }
    };

    // ============ Fill All Missing ============
    const handleFillAllCharacterImages = async () => {
        for (const char of characters) {
            if (!char.imageBase64) await handleGenerateCharacterImage(char.id);
        }
    };
    const handleFillAllSceneImages = async () => {
        for (const scene of scenes) {
            if (!scene.imageBase64) await handleGenerateSceneImage(scene.id);
        }
    };
    const handleFillAllPageImages = async () => {
        for (let i = 0; i < pages.length; i++) {
            if (!pages[i].pageImageBase64) await handleGeneratePageImage(i);
        }
    };

    // ============ Storyboard Preview ============
    const getOrInitPagePrompt = (pageIdx: number): string => {
        if (editedPagePrompts[pageIdx] !== undefined) {
            return editedPagePrompts[pageIdx];
        }
        const generated = buildPageStoryboardPrompt(pages[pageIdx], characters, scenes, imageStylePreset, customImageStyle);
        // Initialize on first access (lazy)
        setEditedPagePrompts(prev => ({ ...prev, [pageIdx]: generated }));
        return generated;
    };

    // ============ Clickable Image ============
    const ClickableImage: React.FC<{ base64: string; alt: string; className?: string }> = ({ base64, alt, className }) => (
        <img
            src={`data:image/png;base64,${base64}`}
            alt={alt}
            className={`${className || ''} cursor-zoom-in`}
            onClick={() => onImageClick(base64, alt)}
        />
    );

    // ============ Section Header ============
    const SectionHeader = ({ id, icon, title, count, color }: { id: string; icon: React.ReactNode; title: string; count?: number; color: string }) => (
        <button
            onClick={() => toggleSection(id)}
            className="w-full flex items-center gap-2 py-3 px-4 bg-zinc-900/60 border border-zinc-800 rounded-lg text-left hover:border-zinc-600 transition-colors"
        >
            <span className={color}>{icon}</span>
            <span className="font-semibold text-white flex-1">{title}</span>
            {count !== undefined && (
                <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">{count}</span>
            )}
            {expandedSections.has(id) ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
        </button>
    );

    const totalPanels = pages.reduce((sum, p) => sum + p.panels.length, 0);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles size={24} className="text-violet-400" />
                        漫畫工作室
                    </h2>
                    <p className="text-zinc-400 mt-1">輸入故事，AI 自動生成漫畫分鏡與畫面</p>
                </div>
                {hasStoryboard && (
                    <button
                        onClick={() => {
                            if (window.confirm('確定要清空目前的工作室嗎？所有未儲存的生成結果都會消失。')) {
                                setStoryText('');
                                setCharacters([]);
                                setScenes([]);
                                setPages([]);
                                setComicInfo(null);
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm transition-colors"
                    >
                        <Trash2 size={16} />
                        清空內容
                    </button>
                )}
            </div>

            {/* Comic Info */}
            {comicInfo && (
                <div className="bg-gradient-to-r from-violet-900/30 to-pink-900/30 border border-violet-800/50 rounded-xl p-5">
                    <h3 className="text-xl font-bold text-white">{comicInfo.title}</h3>
                    <p className="text-zinc-300 mt-2 text-sm">{comicInfo.synopsis}</p>
                    <div className="flex gap-2 mt-3">
                        {comicInfo.tags?.map((tag, i) => (
                            <span key={i} className="text-xs bg-violet-800/50 text-violet-200 px-2 py-1 rounded-full">#{tag}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-200 text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200 underline">關閉</button>
                </div>
            )}

            {/* Story Input */}
            <SectionHeader id="story" icon={<BookOpen size={18} />} title="故事輸入" color="text-emerald-400" />
            {expandedSections.has('story') && (
                <div className="space-y-3">
                    <textarea
                        value={storyText}
                        onChange={e => setStoryText(e.target.value)}
                        placeholder="在這裡貼上你的故事、小說片段、或劇本...\n\nAI 會自動分析角色、場景，並產生漫畫分鏡。"
                        rows={8}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !storyText.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-900/30"
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                        {isGenerating ? '生成分鏡中...' : '生成漫畫分鏡'}
                    </button>
                </div>
            )}

            {!hasStoryboard && !isGenerating && (
                <div className="text-center py-16 text-zinc-500">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                    <p>輸入故事並點擊「生成漫畫分鏡」開始</p>
                </div>
            )}

            {hasStoryboard && (
                <>
                    {/* ============ Characters ============ */}
                    <SectionHeader id="characters" icon={<Users size={18} />} title="角色" count={characters.length} color="text-amber-400" />
                    {expandedSections.has('characters') && (
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <button onClick={handleFillAllCharacterImages} disabled={!!generatingImageFor}
                                    className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-40">
                                    <Zap size={14} /> 批次生成所有角色圖
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {characters.map(char => (
                                    <div key={char.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                                        <div className="aspect-[3/4] bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                                            {char.imageBase64 ? (
                                                <ClickableImage base64={char.imageBase64} alt={char.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Users size={32} className="text-zinc-600" />
                                            )}
                                            {generatingImageFor === `char:${char.id}` && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Loader2 size={24} className="animate-spin text-violet-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">{char.name}</h4>
                                            <textarea
                                                value={char.description}
                                                onChange={e => setCharacters(prev => prev.map(c =>
                                                    c.id === char.id ? { ...c, description: e.target.value } : c
                                                ))}
                                                rows={3}
                                                className="w-full mt-1 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleGenerateCharacterImage(char.id)} disabled={!!generatingImageFor}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-sm text-zinc-300 rounded-lg transition-colors">
                                                {char.imageBase64 ? <RefreshCw size={14} /> : <ImageIcon size={14} />}
                                                {char.imageBase64 ? '重新生成' : 'AI 生成'}
                                            </button>
                                            <label className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 rounded-lg transition-colors cursor-pointer">
                                                <Upload size={14} /> 上傳
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                    const file = e.target.files?.[0]; if (file) handleCharacterImageUpload(char.id, file); e.target.value = '';
                                                }} />
                                            </label>
                                        </div>
                                        {/* useTextDescription toggle — only when image exists */}
                                        {char.imageBase64 && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className="relative">
                                                    <input type="checkbox" className="sr-only peer"
                                                        checked={char.useTextDescription !== false}
                                                        onChange={e => setCharacters(prev => prev.map(c =>
                                                            c.id === char.id ? { ...c, useTextDescription: e.target.checked } : c
                                                        ))}
                                                    />
                                                    <div className="w-8 h-4 bg-zinc-700 rounded-full peer-checked:bg-violet-600 transition-colors"></div>
                                                    <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                                </div>
                                                <span className="text-[11px] text-zinc-400">參考文字描述</span>
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ============ Scenes ============ */}
                    <SectionHeader id="scenes" icon={<Map size={18} />} title="場景" count={scenes.length} color="text-cyan-400" />
                    {expandedSections.has('scenes') && (
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <button onClick={handleFillAllSceneImages} disabled={!!generatingImageFor}
                                    className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-40">
                                    <Zap size={14} /> 批次生成所有場景圖
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {scenes.map(scene => (
                                    <div key={scene.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                                        <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center relative">
                                            {scene.imageBase64 ? (
                                                <ClickableImage base64={scene.imageBase64} alt={scene.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Map size={32} className="text-zinc-600" />
                                            )}
                                            {generatingImageFor === `scene:${scene.id}` && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Loader2 size={24} className="animate-spin text-cyan-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">{scene.name}</h4>
                                            <textarea
                                                value={scene.visualDescription}
                                                onChange={e => setScenes(prev => prev.map(s =>
                                                    s.id === scene.id ? { ...s, visualDescription: e.target.value } : s
                                                ))}
                                                rows={2}
                                                className="w-full mt-1 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleGenerateSceneImage(scene.id)} disabled={!!generatingImageFor}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-sm text-zinc-300 rounded-lg transition-colors">
                                                {scene.imageBase64 ? <RefreshCw size={14} /> : <ImageIcon size={14} />}
                                                {scene.imageBase64 ? '重新生成' : 'AI 生成'}
                                            </button>
                                            <label className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 rounded-lg transition-colors cursor-pointer">
                                                <Upload size={14} /> 上傳
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                    const file = e.target.files?.[0]; if (file) handleSceneImageUpload(scene.id, file); e.target.value = '';
                                                }} />
                                            </label>
                                        </div>
                                        {/* useTextDescription toggle — only when image exists */}
                                        {scene.imageBase64 && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className="relative">
                                                    <input type="checkbox" className="sr-only peer"
                                                        checked={scene.useTextDescription !== false}
                                                        onChange={e => setScenes(prev => prev.map(s =>
                                                            s.id === scene.id ? { ...s, useTextDescription: e.target.checked } : s
                                                        ))}
                                                    />
                                                    <div className="w-8 h-4 bg-zinc-700 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
                                                    <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                                </div>
                                                <span className="text-[11px] text-zinc-400">參考文字描述</span>
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ============ Pages ============ */}
                    <SectionHeader id="pages" icon={<Eye size={18} />} title={`分鏡 (${pages.length} 頁 / ${totalPanels} 格)`} color="text-pink-400" />
                    {expandedSections.has('pages') && (
                        <div className="space-y-8">
                            <div className="flex justify-end">
                                <button onClick={handleFillAllPageImages} disabled={!!generatingImageFor}
                                    className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-40">
                                    <Zap size={14} /> 批次生成所有頁面
                                </button>
                            </div>

                            {pages.map((page, pageIdx) => {
                                const pageImage = page.pageImageBase64;
                                const isGeneratingPage = generatingImageFor === `page:${pageIdx}`;
                                const showPrompt = expandedPagePrompt.has(pageIdx);

                                return (
                                    <div key={pageIdx} className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                                        {/* Page header */}
                                        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                                            <h4 className="font-semibold text-white">
                                                📄 第 {pageIdx + 1} 頁 — {page.panels.length} 格
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => {
                                                    const next = new Set(expandedPagePrompt);
                                                    next.has(pageIdx) ? next.delete(pageIdx) : next.add(pageIdx);
                                                    setExpandedPagePrompt(next);
                                                }} className="text-xs text-zinc-400 hover:text-zinc-200">
                                                    {showPrompt ? '隱藏 Prompt' : '顯示 Prompt'}
                                                </button>
                                                {/* Share button */}
                                                {pageImage && (
                                                    <button onClick={() => onShare(pageImage)}
                                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 bg-emerald-900/30 hover:bg-emerald-900/50 rounded-lg transition-colors">
                                                        <Share2 size={12} /> 分享
                                                    </button>
                                                )}
                                                <button onClick={() => handleGeneratePageImage(pageIdx)} disabled={!!generatingImageFor}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 text-sm text-white font-medium rounded-lg transition-all">
                                                    {isGeneratingPage ? <Loader2 size={14} className="animate-spin" /> : (pageImage ? <RefreshCw size={14} /> : <Wand2 size={14} />)}
                                                    {pageImage ? '重新生成' : '生成此頁'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Editable Prompt */}
                                        {showPrompt && (
                                            <div className="px-5 py-3 bg-zinc-950/50 border-b border-zinc-800 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-zinc-500 font-medium">Storyboard Prompt（可直接編輯）</span>
                                                    <button
                                                        onClick={() => {
                                                            const generated = buildPageStoryboardPrompt(pages[pageIdx], characters, scenes, imageStylePreset, customImageStyle);
                                                            setEditedPagePrompts(prev => ({ ...prev, [pageIdx]: generated }));
                                                        }}
                                                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                                    >
                                                        <RefreshCw size={10} /> 重設為自動生成
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={getOrInitPagePrompt(pageIdx)}
                                                    onChange={e => setEditedPagePrompts(prev => ({ ...prev, [pageIdx]: e.target.value }))}
                                                    className="w-full text-[11px] text-zinc-400 bg-zinc-900/80 border border-zinc-700 rounded-lg p-3 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                    rows={12}
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-col lg:flex-row">
                                            {/* Panel breakdown */}
                                            <div className="flex-1 p-4 space-y-3 border-r border-zinc-800/50">
                                                {page.panels.map((panel, panelIdx) => {
                                                    const panelTypeLabel = { normal: '標準', wide: '寬', tall: '高', splash: '跨頁' }[panel.panelType];
                                                    const panelTypeColor = { normal: 'bg-zinc-700', wide: 'bg-blue-800/50', tall: 'bg-emerald-800/50', splash: 'bg-amber-800/50' }[panel.panelType];
                                                    return (
                                                        <div key={panel.id} className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-zinc-400">格 {panelIdx + 1}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${panelTypeColor} text-white/80`}>{panelTypeLabel}</span>
                                                            </div>
                                                            <p className="text-xs text-zinc-400 line-clamp-2">{panel.imagePrompt}</p>
                                                            {panel.dialogues.map((d, i) => (
                                                                <div key={i} className="flex items-start gap-1.5 text-xs">
                                                                    <MessageSquare size={11} className={`mt-0.5 flex-shrink-0 ${d.type === 'thought' ? 'text-blue-400' : d.type === 'narration' ? 'text-amber-400' : d.type === 'sfx' ? 'text-red-400' : 'text-zinc-500'
                                                                        }`} />
                                                                    <span>
                                                                        {d.type !== 'sfx' && <span className="font-medium text-zinc-300">{d.character}: </span>}
                                                                        <span className="text-zinc-500">{d.text}</span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Generated page image */}
                                            <div className="lg:w-80 p-4 flex items-center justify-center">
                                                <div className="w-full aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative">
                                                    {pageImage ? (
                                                        <ClickableImage base64={pageImage} alt={`Page ${pageIdx + 1}`} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="text-center text-zinc-600">
                                                            <ImageIcon size={32} className="mx-auto mb-2" />
                                                            <span className="text-sm">尚未生成</span>
                                                        </div>
                                                    )}
                                                    {isGeneratingPage && (
                                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                                                            <Loader2 size={32} className="animate-spin text-pink-400" />
                                                            <span className="text-xs text-zinc-300">生成整頁漫畫中...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
