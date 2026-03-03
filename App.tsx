/**
 * App.tsx — Main Application Controller
 * Handles page navigation, shared state management, and image lightbox
 *
 * KEY: Both pages are always rendered (with display:none toggling)
 * so StudioPage state is never lost when switching to Config.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Sparkles, Settings2, BookOpen, X, Download, Share2,
} from 'lucide-react';
import {
    AppPage, GeminiModel, GeminiImageModel, ImageStylePreset,
    ComicCharacter, ComicScene, ComicPageData, GeneratedComicInfo,
} from './types';
import { StudioPage } from './pages/StudioPage';
import { ConfigPage } from './pages/ConfigPage';

// ============ Image Lightbox Component ============
const ImageLightbox: React.FC<{
    src: string | null;
    alt?: string;
    onClose: () => void;
}> = ({ src, alt, onClose }) => {
    if (!src) return null;
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/60 hover:text-white z-10"
            >
                <X size={28} />
            </button>
            <img
                src={src}
                alt={alt || 'Preview'}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            />
        </div>
    );
};

// ============ Share Modal Component ============
const ShareModal: React.FC<{
    imageBase64: string | null;
    comicInfo: GeneratedComicInfo | null;
    onClose: () => void;
}> = ({ imageBase64, comicInfo, onClose }) => {
    if (!imageBase64) return null;

    const title = comicInfo?.title || 'AI Comic';
    const text = comicInfo?.synopsis || '用 AI 產生的漫畫！';

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${imageBase64}`;
        link.download = `${title}.png`;
        link.click();
    };

    const handleNativeShare = async () => {
        try {
            // Convert base64 to blob for native share
            const res = await fetch(`data:image/png;base64,${imageBase64}`);
            const blob = await res.blob();
            const file = new File([blob], `${title}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: title,
                    text: text,
                    files: [file],
                });
            } else if (navigator.share) {
                await navigator.share({
                    title: title,
                    text: text,
                });
            } else {
                alert('您的瀏覽器不支援分享功能，請使用下載後手動分享');
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Share error:', e);
            }
        }
    };

    const handleCopyImage = async () => {
        try {
            const res = await fetch(`data:image/png;base64,${imageBase64}`);
            const blob = await res.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('圖片已複製到剪貼簿！');
        } catch (e) {
            alert('無法複製圖片，請使用下載功能');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full space-y-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Share2 size={20} className="text-violet-400" />
                        分享漫畫
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
                </div>

                {/* Preview thumbnail */}
                <div className="aspect-[3/4] max-h-48 mx-auto overflow-hidden rounded-lg bg-zinc-800">
                    <img src={`data:image/png;base64,${imageBase64}`} alt={title} className="w-full h-full object-contain" />
                </div>

                <p className="text-sm text-zinc-400 text-center">{title}</p>

                {/* Share actions */}
                <div className="space-y-2">
                    <button
                        onClick={handleNativeShare}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all"
                    >
                        <Share2 size={18} />
                        分享至社群
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        >
                            <Download size={16} />
                            下載圖片
                        </button>
                        <button
                            onClick={handleCopyImage}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        >
                            📋 複製圖片
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============ Main App ============
const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<AppPage>('studio');

    // ============ Configuration State ============
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [saveGeminiKey, setSaveGeminiKey] = useState(false);
    const [geminiModel, setGeminiModel] = useState<GeminiModel>('gemini-2.5-flash');
    const [imageModel, setImageModel] = useState<GeminiImageModel>('gemini-2.0-flash-exp');
    const [imageStylePreset, setImageStylePreset] = useState<ImageStylePreset>('manga');
    const [customImageStyle, setCustomImageStyle] = useState('');

    // ============ Studio State (lifted up for persistence) ============
    const [storyText, setStoryText] = useState('');
    const [characters, setCharacters] = useState<ComicCharacter[]>([]);
    const [scenes, setScenes] = useState<ComicScene[]>([]);
    const [pages, setPages] = useState<ComicPageData[]>([]);
    const [comicInfo, setComicInfo] = useState<GeneratedComicInfo | null>(null);
    const [editedPagePrompts, setEditedPagePrompts] = useState<Record<number, string>>({});

    // ============ Lightbox & Share State ============
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [lightboxAlt, setLightboxAlt] = useState<string>('');
    const [shareImage, setShareImage] = useState<string | null>(null);

    const openLightbox = useCallback((base64: string, alt?: string) => {
        setLightboxImage(`data:image/png;base64,${base64}`);
        setLightboxAlt(alt || 'Preview');
    }, []);

    const openShare = useCallback((base64: string) => {
        setShareImage(base64);
    }, []);

    // ============ Load saved keys ============
    useEffect(() => {
        const savedKey = localStorage.getItem('comic_gemini_api_key');
        if (savedKey) {
            setGeminiApiKey(savedKey);
            setSaveGeminiKey(true);
        }
        const savedModel = localStorage.getItem('comic_gemini_model');
        if (savedModel) setGeminiModel(savedModel as GeminiModel);
        const savedImageModel = localStorage.getItem('comic_image_model');
        if (savedImageModel) setImageModel(savedImageModel as GeminiImageModel);
        const savedStyle = localStorage.getItem('comic_image_style');
        if (savedStyle) setImageStylePreset(savedStyle as ImageStylePreset);
        const savedCustomStyle = localStorage.getItem('comic_custom_style');
        if (savedCustomStyle) setCustomImageStyle(savedCustomStyle);
    }, []);

    // ============ Save settings ============
    useEffect(() => {
        if (saveGeminiKey && geminiApiKey) {
            localStorage.setItem('comic_gemini_api_key', geminiApiKey);
        } else {
            localStorage.removeItem('comic_gemini_api_key');
        }
    }, [geminiApiKey, saveGeminiKey]);

    useEffect(() => { localStorage.setItem('comic_gemini_model', geminiModel); }, [geminiModel]);
    useEffect(() => { localStorage.setItem('comic_image_model', imageModel); }, [imageModel]);
    useEffect(() => { localStorage.setItem('comic_image_style', imageStylePreset); }, [imageStylePreset]);
    useEffect(() => { localStorage.setItem('comic_custom_style', customImageStyle); }, [customImageStyle]);

    // ============ Navigation ============
    const navItems: { page: AppPage; label: string; icon: React.ReactNode }[] = [
        { page: 'studio', label: '工作室', icon: <Sparkles size={18} /> },
        { page: 'config', label: '設定', icon: <Settings2 size={18} /> },
    ];

    return (
        <div className="min-h-screen bg-[#0f0f14]">
            {/* Lightbox */}
            <ImageLightbox src={lightboxImage} alt={lightboxAlt} onClose={() => setLightboxImage(null)} />
            {/* Share Modal */}
            <ShareModal imageBase64={shareImage} comicInfo={comicInfo} onClose={() => setShareImage(null)} />

            {/* Top navigation bar */}
            <nav className="border-b border-zinc-800/80 bg-[#0f0f14]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 flex items-center h-14">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mr-8">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                            <BookOpen size={16} className="text-white" />
                        </div>
                        <span className="font-bold text-white text-lg">
                            AI Comic
                        </span>
                    </div>

                    {/* Nav items */}
                    <div className="flex gap-1">
                        {navItems.map(({ page, label, icon }) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentPage === page
                                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                    }`}
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* API Key status */}
                    <div className="ml-auto">
                        {geminiApiKey ? (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                API Connected
                            </span>
                        ) : (
                            <span className="text-xs text-zinc-500">No API Key</span>
                        )}
                    </div>
                </div>
            </nav>

            {/* Page content — BOTH pages always rendered, toggled via display */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div style={{ display: currentPage === 'studio' ? 'block' : 'none' }}>
                    <StudioPage
                        geminiApiKey={geminiApiKey}
                        geminiModel={geminiModel}
                        imageModel={imageModel}
                        imageStylePreset={imageStylePreset}
                        customImageStyle={customImageStyle}
                        // Lifted state
                        storyText={storyText}
                        setStoryText={setStoryText}
                        characters={characters}
                        setCharacters={setCharacters}
                        scenes={scenes}
                        setScenes={setScenes}
                        pages={pages}
                        setPages={setPages}
                        comicInfo={comicInfo}
                        setComicInfo={setComicInfo}
                        // Lightbox & Share
                        onImageClick={openLightbox}
                        onShare={openShare}
                        // Editable prompts
                        editedPagePrompts={editedPagePrompts}
                        setEditedPagePrompts={setEditedPagePrompts}
                    />
                </div>
                <div style={{ display: currentPage === 'config' ? 'block' : 'none' }}>
                    <ConfigPage
                        geminiApiKey={geminiApiKey}
                        setGeminiApiKey={setGeminiApiKey}
                        saveGeminiKey={saveGeminiKey}
                        setSaveGeminiKey={setSaveGeminiKey}
                        geminiModel={geminiModel}
                        setGeminiModel={setGeminiModel}
                        imageModel={imageModel}
                        setImageModel={setImageModel}
                        imageStylePreset={imageStylePreset}
                        setImageStylePreset={setImageStylePreset}
                        customImageStyle={customImageStyle}
                        setCustomImageStyle={setCustomImageStyle}
                    />
                </div>
            </main>
        </div>
    );
};

export default App;
