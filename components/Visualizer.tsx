import React, { useState, useEffect, useRef } from 'react';
import { Scenario, StepType } from '../types';
import { TreeGraph } from './TreeGraph';
import { 
  Play, Pause, SkipBack, SkipForward, RotateCcw, 
  CheckCircle, XCircle, ArrowDownLeft, ArrowDownRight, Scissors, 
  CornerUpLeft, Search, ListChecks
} from 'lucide-react';

interface VisualizerProps {
  scenario: Scenario;
  onReset: () => void;
}

export const Visualizer: React.FC<VisualizerProps> = ({ scenario, onReset }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStep = scenario.steps[stepIndex];
  const isLastStep = stepIndex === scenario.steps.length - 1;

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setStepIndex((prev) => {
          if (prev >= scenario.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, scenario.steps.length, speed]);

  const handlePlayToggle = () => {
    if (isLastStep && !isPlaying) {
        // If at the end and pressing play, restart from beginning
        setStepIndex(0);
        setIsPlaying(true);
    } else {
        setIsPlaying(!isPlaying);
    }
  };

  const getBarColor = (idx: number) => {
    // FINAL STATE: Highlight the "Best Candidate" if search is complete and successful
    if (isLastStep && scenario.outcome === 'success' && scenario.bestSolutionIndices?.includes(idx)) {
        return "bg-yellow-500 border-2 border-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.5)] z-20 scale-105";
    }

    if (currentStep.currentSelection.includes(idx)) return "bg-green-500";
    // If we are currently processing this index and decided to EXCLUDE it
    if (currentStep.utxoIndex === idx && currentStep.type === StepType.EXCLUDE) return "bg-red-500/50";
    // If we are currently processing this index and decided to INCLUDE it
    if (currentStep.utxoIndex === idx && currentStep.type === StepType.INCLUDE) return "bg-green-400 border-2 border-white";
    // Future considerations
    if (idx > currentStep.utxoIndex) return "bg-slate-600";
    // Past exclusions
    return "bg-slate-800";
  };

  // --- Dynamic Status Banner Logic ---
  const getStatusContent = () => {
    // 1. Solution Found State (Intermediate)
    if (currentStep.type === StepType.SOLUTION) {
        return {
            colorClass: "bg-green-950/50 border-green-800 text-green-300",
            icon: <CheckCircle className="shrink-0 text-green-400" size={28} />,
            title: "Solution Candidate Found",
            desc: "Match! Bitcoin Core now checks if this is the 'least wasteful' option and continues searching."
        };
    }

    // 2. End of Search
    if (isLastStep) {
        if (scenario.outcome === 'success') {
            return {
                colorClass: "bg-emerald-900/40 border-emerald-700 text-emerald-200",
                icon: <ListChecks className="shrink-0 text-emerald-400" size={28} />,
                title: "Search Complete",
                desc: "All branches explored. The best candidate (highlighted in gold) is selected."
            };
        } else {
            return {
                colorClass: "bg-red-950/50 border-red-800 text-red-300",
                icon: <XCircle className="shrink-0 text-red-400" size={28} />,
                title: "Search Failed",
                desc: "No exact match found. Core would fall back to the Knapsack (SRD) solver."
            };
        }
    }

    // 3. In Progress States
    switch (currentStep.type) {
        case StepType.INCLUDE:
            return {
                colorClass: "bg-blue-950/50 border-blue-800 text-blue-200",
                icon: <ArrowDownLeft className="shrink-0 text-blue-400" size={28} />,
                title: "Including UTXO",
                desc: currentStep.description
            };
        case StepType.EXCLUDE:
            return {
                colorClass: "bg-slate-800/80 border-slate-600 text-orange-200",
                icon: <ArrowDownRight className="shrink-0 text-orange-400" size={28} />,
                title: "Excluding UTXO",
                desc: currentStep.description
            };
        case StepType.PRUNE_SUM:
        case StepType.PRUNE_VAL:
            return {
                colorClass: "bg-slate-900 border-red-900/50 text-red-200",
                icon: <Scissors className="shrink-0 text-red-400" size={28} />,
                title: "Pruning Branch",
                desc: currentStep.description
            };
        case StepType.BACKTRACK:
            return {
                colorClass: "bg-slate-800 border-slate-700 text-slate-300",
                icon: <CornerUpLeft className="shrink-0 text-slate-400" size={28} />,
                title: "Backtracking",
                desc: currentStep.description
            };
        case StepType.START:
        default:
            return {
                colorClass: "bg-slate-800 border-slate-700 text-slate-300",
                icon: <Search className="shrink-0 text-blue-400" size={28} />,
                title: "Starting Search",
                desc: "Initializing Branch and Bound algorithm..."
            };
    }
  };

  const status = getStatusContent();

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm uppercase tracking-wider font-bold">Target Amount</div>
          <div className="text-2xl font-mono text-white">{scenario.target.toLocaleString()} sats</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
            <div className={`absolute inset-0 opacity-10 transition-colors duration-300 ${currentStep.currentSum > scenario.target ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <div className="relative z-10">
                <div className="text-slate-400 text-sm uppercase tracking-wider font-bold">Current Selection</div>
                <div className={`text-2xl font-mono ${currentStep.currentSum === scenario.target ? 'text-yellow-400' : 'text-white'}`}>
                    {currentStep.currentSum.toLocaleString()} sats
                </div>
            </div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
          <div className="text-slate-400 text-sm uppercase tracking-wider font-bold">Depth</div>
          <div className="text-2xl font-mono text-blue-300">{currentStep.depth}</div>
        </div>
      </div>

      {/* Dynamic Status / Result Banner */}
      <div className={`p-4 rounded-xl border shadow-lg flex items-center gap-4 transition-all duration-300 ${status.colorClass}`}>
        <div className="bg-black/20 p-2 rounded-full">
            {status.icon}
        </div>
        <div>
            <div className="font-bold text-base uppercase tracking-wider">
                {status.title}
            </div>
            <div className="text-sm md:text-base opacity-90 font-light">
                {status.desc}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: UTXO List & Graph */}
        <div className="lg:col-span-2 space-y-6">
           {/* Tree Visualization */}
           <TreeGraph 
              steps={scenario.steps} 
              currentStepIndex={stepIndex}
              utxos={scenario.utxos} 
              bestSolutionPath={isLastStep && scenario.outcome === 'success' ? scenario.bestSolutionPath : undefined}
              candidates={scenario.candidates || []}
              isPlaying={isPlaying}
            />

           {/* Control Bar */}
           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button 
                    onClick={() => setStepIndex(0)} 
                    disabled={stepIndex === 0}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                    <RotateCcw size={20} />
                </button>
                <button 
                    onClick={() => setStepIndex(Math.max(0, stepIndex - 1))} 
                    disabled={stepIndex === 0}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                    <SkipBack size={20} />
                </button>
                <button 
                    onClick={handlePlayToggle}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500 text-white hover:bg-green-600'}`}
                >
                    {isPlaying ? <><Pause size={18} /> Pause</> : <><Play size={18} /> {isLastStep ? 'Restart' : 'Resume'}</>}
                </button>
                <button 
                    onClick={() => setStepIndex(Math.min(scenario.steps.length - 1, stepIndex + 1))} 
                    disabled={isLastStep}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                    <SkipForward size={20} />
                </button>
              </div>

              <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                 <span className="text-xs font-bold text-slate-500">SPEED</span>
                 <input 
                    type="range" 
                    min="100" 
                    max="2000" 
                    step="100"
                    value={2100 - speed} 
                    onChange={(e) => setSpeed(2100 - parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="text-xs font-mono text-slate-500">
                Step {stepIndex + 1} / {scenario.steps.length}
              </div>
           </div>
        </div>

        {/* Right: UTXO List & Reset */}
        <div className="space-y-6">
            {/* UTXO Stack */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-3 bg-slate-900 border-b border-slate-700 font-bold text-slate-300 text-sm flex justify-between">
                    <span>UTXO Pool (Sorted Desc)</span>
                    <span className="text-slate-500 text-xs">{scenario.utxos.length} Items</span>
                </div>
                <div className="p-2 space-y-2 max-h-[450px] overflow-y-auto">
                    {scenario.utxos.map((utxo, idx) => (
                        <div key={utxo.id} className={`
                            relative p-3 rounded-lg border transition-all duration-300
                            ${getBarColor(idx)}
                            ${currentStep.utxoIndex === idx ? 'scale-105 z-10 shadow-xl' : 'border-transparent bg-opacity-40'}
                        `}>
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-white font-bold">#{idx}</span>
                                <span className="font-mono text-white">{utxo.value.toLocaleString()}</span>
                            </div>
                             {/* Highlight if explicitly in the "best" selection or current selection */}
                             {((isLastStep && scenario.bestSolutionIndices?.includes(idx)) || (!isLastStep && currentStep.currentSelection.includes(idx))) && (
                                <div className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-20 ${isLastStep ? 'text-yellow-900' : 'text-green-900'}`}>
                                    {isLastStep ? <CheckCircle fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

             <button onClick={onReset} className="w-full py-3 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm">
                Reset / New Scenario
            </button>
        </div>
      </div>
    </div>
  );
};