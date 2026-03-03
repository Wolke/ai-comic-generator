/**
 * ConfigPage — API Keys and Settings
 */

import React from 'react';
import {
    Key, Save, Eye, EyeOff, Palette,
} from 'lucide-react';
import {
    GEMINI_MODELS, GeminiModel,
    GEMINI_IMAGE_MODELS, GeminiImageModel,
    IMAGE_STYLE_PRESETS, ImageStylePreset,
} from '../types';

interface ConfigPageProps {
    geminiApiKey: string;
    setGeminiApiKey: (key: string) => void;
    saveGeminiKey: boolean;
    setSaveGeminiKey: (v: boolean) => void;
    geminiModel: GeminiModel;
    setGeminiModel: (m: GeminiModel) => void;
    imageModel: GeminiImageModel;
    setImageModel: (m: GeminiImageModel) => void;
    imageStylePreset: ImageStylePreset;
    setImageStylePreset: (p: ImageStylePreset) => void;
    customImageStyle: string;
    setCustomImageStyle: (s: string) => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({
    geminiApiKey, setGeminiApiKey, saveGeminiKey, setSaveGeminiKey,
    geminiModel, setGeminiModel,
    imageModel, setImageModel,
    imageStylePreset, setImageStylePreset,
    customImageStyle, setCustomImageStyle,
}) => {
    const [showKey, setShowKey] = React.useState(false);

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Key size={24} className="text-violet-400" />
                    設定
                </h2>
                <p className="text-zinc-400 mt-1">管理 API 金鑰與生成偏好設定</p>
            </div>

            {/* API Key Section */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Key size={18} className="text-amber-400" />
                    Gemini API Key
                </h3>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={geminiApiKey}
                        onChange={e => setGeminiApiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-12"
                    />
                    <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={saveGeminiKey}
                        onChange={e => setSaveGeminiKey(e.target.checked)}
                        className="rounded border-zinc-600"
                    />
                    <Save size={14} />
                    記住金鑰（localStorage）
                </label>
            </div>

            {/* Model Selection */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">模型設定</h3>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm text-zinc-400 block mb-1">腳本生成模型</label>
                        <select
                            value={geminiModel}
                            onChange={e => setGeminiModel(e.target.value as GeminiModel)}
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            {GEMINI_MODELS.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 block mb-1">影像生成模型</label>
                        <select
                            value={imageModel}
                            onChange={e => setImageModel(e.target.value as GeminiImageModel)}
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            {GEMINI_IMAGE_MODELS.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Style Settings */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Palette size={18} className="text-pink-400" />
                    漫畫風格
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {IMAGE_STYLE_PRESETS.map(preset => (
                        <button
                            key={preset.value}
                            onClick={() => setImageStylePreset(preset.value)}
                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border ${imageStylePreset === preset.value
                                    ? 'bg-violet-600/30 border-violet-500 text-violet-200'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {imageStylePreset === 'custom' && (
                    <textarea
                        value={customImageStyle}
                        onChange={e => setCustomImageStyle(e.target.value)}
                        placeholder="e.g. Studio Ghibli watercolor style, soft pastels..."
                        rows={3}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                )}
            </div>
        </div>
    );
};
