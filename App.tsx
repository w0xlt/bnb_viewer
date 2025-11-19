import React, { useState, useEffect } from 'react';
import { generateScenario } from './services/bnbAlgorithm';
import { Scenario } from './types';
import { Visualizer } from './components/Visualizer';
import { Bitcoin, RefreshCw } from 'lucide-react';

const DEFAULT_UTXOS = [100000, 60000, 55000, 50000, 25000, 10000];
const DEFAULT_TARGET = 110000;

export default function App() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [customTarget, setCustomTarget] = useState<string>(DEFAULT_TARGET.toString());
  const [isGenerating, setIsGenerating] = useState(false);

  // Initial Load
  useEffect(() => {
    handleGenerate(DEFAULT_UTXOS, DEFAULT_TARGET);
  }, []);

  const handleGenerate = (utxos: number[], target: number) => {
    setIsGenerating(true);
    // Small timeout to allow UI to show loading state
    setTimeout(() => {
      const newScenario = generateScenario(utxos, target);
      setScenario(newScenario);
      setIsGenerating(false);
    }, 300);
  };

  const handleRandomize = () => {
    const count = 6;
    const newUtxos: number[] = [];
    for(let i=0; i<count; i++) {
        // Random values between 10k and 100k
        newUtxos.push(Math.floor(Math.random() * 90000) + 10000);
    }
    // Set target to be reachable (sum of 2 random items + tiny offset maybe)
    const target = newUtxos[0] + newUtxos[2] + (Math.random() > 0.5 ? 0 : 5000);
    setCustomTarget(target.toString());
    handleGenerate(newUtxos, target);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-orange-500 p-2 rounded-full text-white shadow-lg shadow-orange-500/20">
                    <Bitcoin size={24} />
                </div>
                <div>
                    <h1 className="font-bold text-xl text-white tracking-tight">BnB Visualizer</h1>
                    <p className="text-xs text-slate-500">Bitcoin Core Coin Selection</p>
                </div>
            </div>
            
            <a href="https://github.com/bitcoin/bitcoin" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-orange-400 transition-colors hidden sm:block">
                Based on Bitcoin Core Logic
            </a>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {!scenario || isGenerating ? (
             <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="animate-spin text-blue-500 mb-4">
                    <RefreshCw size={48} />
                </div>
                <p className="text-slate-400 animate-pulse">Calculating Branch & Bound paths...</p>
             </div>
        ) : (
            <Visualizer 
                scenario={scenario} 
                onReset={() => handleGenerate(DEFAULT_UTXOS, parseInt(customTarget) || DEFAULT_TARGET)} 
            />
        )}

        {/* Scenario Config Panel (Only visible if scenario loaded) */}
        {scenario && !isGenerating && (
             <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800">
                <h3 className="text-slate-400 font-bold mb-4 uppercase text-sm tracking-wider">Scenario Settings</h3>
                <div className="flex flex-wrap gap-4 items-end bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-slate-500 font-semibold">Target Amount (sats)</label>
                        <input 
                            type="number" 
                            value={customTarget}
                            onChange={(e) => setCustomTarget(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 w-48"
                        />
                    </div>
                    <button 
                        onClick={() => handleGenerate(DEFAULT_UTXOS, parseInt(customTarget) || DEFAULT_TARGET)}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white transition-colors font-medium"
                    >
                        Apply Target
                    </button>
                    <div className="w-px h-10 bg-slate-700 mx-2"></div>
                     <button 
                        onClick={handleRandomize}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        <RefreshCw size={16} />
                        Generate Random
                    </button>
                </div>
                <p className="mt-4 text-slate-500 text-sm max-w-2xl">
                    Note: This visualizer fully explores the search tree to mimic Core's behavior of finding the "Least Wasteful" solution.
                    Core does not stop at the first match; it continues searching (up to a limit) to optimize fees and input usage.
                </p>
             </div>
        )}
      </main>
    </div>
  );
}