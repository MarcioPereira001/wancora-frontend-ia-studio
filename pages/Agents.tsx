import React, { useState } from 'react';
import { Bot, Save, Play, RefreshCw, Zap } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { refineAgentPrompt } from '../services/geminiService';

export const Agents: React.FC = () => {
  const [prompt, setPrompt] = useState("You are a helpful support assistant for Wancora CRM. Be polite and concise.");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [temperature, setTemperature] = useState(0.7);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    const refined = await refineAgentPrompt(prompt);
    setPrompt(refined);
    setIsOptimizing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" />
            AI Agent Configuration
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Configure your autonomous sales and support agents powered by Gemini.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-32 h-32 text-primary" />
                </div>
                
                <div className="space-y-4 relative z-10">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Agent Name</label>
                        <input 
                            type="text" 
                            defaultValue="Sales Specialist Alpha" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-100 focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-zinc-300">System Prompt</label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleOptimize}
                                isLoading={isOptimizing}
                                className="text-xs text-secondary hover:text-secondary h-6"
                            >
                                <SparklesIcon className="w-3 h-3 mr-1" />
                                Optimize with AI
                            </Button>
                        </div>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 focus:ring-1 focus:ring-primary outline-none font-mono leading-relaxed resize-none"
                        />
                        <p className="text-xs text-zinc-500 mt-2">
                            This prompt defines the personality and rules for your agent.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="outline">Discard Changes</Button>
                <Button variant="primary">
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                </Button>
            </div>
        </div>

        {/* Sidebar Config */}
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">Model Settings</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Model</label>
                        <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none">
                            <option value="gemini-3-flash">Gemini 3 Flash (Recommended)</option>
                            <option value="gemini-3-pro">Gemini 3 Pro</option>
                            <option value="gpt-4o">GPT-4o (Legacy)</option>
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between mb-1.5">
                            <label className="block text-xs font-medium text-zinc-400">Creativity (Temperature)</label>
                            <span className="text-xs text-primary">{temperature}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1" 
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                            <span>Precise</span>
                            <span>Creative</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-zinc-300">Active Status</span>
                            <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-primary">
                                <span className="translate-x-5 inline-block h-3 w-3 transform rounded-full bg-white transition" />
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500">Agent is currently handling new conversations.</p>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Play className="w-5 h-5 text-zinc-400" />
                </div>
                <h4 className="text-sm font-medium text-zinc-300">Test Playground</h4>
                <p className="text-xs text-zinc-500 mt-1 mb-3">Simulate a conversation before going live.</p>
                <Button variant="secondary" size="sm" className="w-full">Open Simulator</Button>
            </div>
        </div>
      </div>
    </div>
  );
};

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);
