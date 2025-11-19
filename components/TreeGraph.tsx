import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AlgorithmStep, StepType, Utxo, SolutionCandidate } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface TreeGraphProps {
  steps: AlgorithmStep[];
  currentStepIndex: number;
  utxos: Utxo[];
  bestSolutionPath?: boolean[];
  candidates?: SolutionCandidate[];
  isPlaying?: boolean;
}

interface TreeNode {
  id: string;
  x: number;
  y: number;
  path: boolean[]; // The path from root to here
  status: 'pending' | 'visited' | 'active' | 'pruned' | 'solution';
  type?: StepType; // The step type that created this state
}

interface TreeEdge {
  id: string;
  source: TreeNode;
  target: TreeNode;
  direction: boolean; // true = left (include), false = right (exclude)
  utxoValue: number;
}

interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export const TreeGraph: React.FC<TreeGraphProps> = ({ steps, currentStepIndex, utxos, bestSolutionPath, candidates = [], isPlaying = false }) => {
  // Base dimensions for calculation only
  const baseWidth = 800; 
  const rootY = 50;
  
  // Interactive State
  const [manualViewBox, setManualViewBox] = useState<ViewBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Build the tree state based on history up to currentStepIndex
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    const edgeList: TreeEdge[] = [];

    // Helper to get ID from path
    const getPathId = (p: boolean[]) => p.map(b => b ? '1' : '0').join('');
    
    // Initial Root Node
    const rootPath: boolean[] = [];
    const rootId = getPathId(rootPath);
    nodeMap.set(rootId, {
      id: rootId,
      x: baseWidth / 2,
      y: rootY,
      path: [],
      status: 'pending'
    });

    // Iterate through all steps up to current index to build structure
    for (let i = 0; i <= currentStepIndex; i++) {
      const step = steps[i];
      const currentPathId = getPathId(step.path);
      
      let currX = baseWidth / 2;
      let currY = rootY;
      let currentPathArr: boolean[] = [];
      
      // Trace down the path to ensure all intermediate nodes/edges exist
      step.path.forEach((direction, depthIdx) => {
        const parentPath = [...currentPathArr];
        const parentId = getPathId(parentPath);
        const parentNode = nodeMap.get(parentId);
        
        currentPathArr.push(direction);
        const childId = getPathId(currentPathArr);
        
        // Calculate Child Position
        // Spread reduces with depth. 
        const level = depthIdx + 1;
        // Adjusted spread factor to prevent overlap in deeper trees
        const spread = (baseWidth * 0.8) / Math.pow(2, level); 
        
        const childX = parentNode ? (direction ? parentNode.x - spread : parentNode.x + spread) : currX;
        const childY = rootY + (level * 70); // Increased vertical spacing

        if (!nodeMap.has(childId)) {
           nodeMap.set(childId, {
             id: childId,
             x: childX,
             y: childY,
             path: [...currentPathArr],
             status: 'visited'
           });
           
           if (parentNode) {
             edgeList.push({
               id: `${parentId}->${childId}`,
               source: parentNode,
               target: nodeMap.get(childId)!,
               direction: direction,
               utxoValue: utxos[depthIdx] ? utxos[depthIdx].value : 0
             });
           }
        }
        currX = childX;
        currY = childY;
      });

      // Update the status of the specific node targeted by this step
      const node = nodeMap.get(currentPathId);
      if (node) {
        if (i === currentStepIndex) {
          node.status = 'active';
        } else if (node.status !== 'pruned' && node.status !== 'solution') {
            node.status = 'visited';
        }

        if (step.type === StepType.PRUNE_SUM || step.type === StepType.PRUNE_VAL) {
           node.status = 'pruned';
        }
        if (step.type === StepType.SOLUTION) {
           node.status = 'solution';
        }
        
        // Override for current step visual priority
        if (i === currentStepIndex) {
            if (step.type === StepType.PRUNE_SUM || step.type === StepType.PRUNE_VAL) {
                node.status = 'pruned';
                node.type = step.type;
            } else if (step.type === StepType.SOLUTION) {
                node.status = 'solution';
                node.type = step.type;
            } else {
                node.status = 'active';
            }
        }
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [steps, currentStepIndex, utxos]);

  // Calculate Auto-Fit ViewBox
  const autoViewBox: ViewBox = useMemo(() => {
    if (nodes.length === 0) return { x: 0, y: 0, w: 800, h: 450 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
    });

    const paddingX = 100;
    const paddingY = 60;

    const width = Math.max(800, maxX - minX + (paddingX * 2));
    const height = Math.max(450, maxY - minY + (paddingY * 2));
    
    const finalX = minX - paddingX;
    const finalY = minY - paddingY;

    return { x: finalX, y: finalY, w: width, h: height };
  }, [nodes]);

  // Reactivate Auto-Fit when playing
  useEffect(() => {
    if (isPlaying) {
        setManualViewBox(null);
    }
  }, [isPlaying]);

  const currentViewBox = manualViewBox || autoViewBox;

  // Interaction Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (isPlaying) return; 
    e.preventDefault();
    
    // Smoother zoom: reduced scale factor (5% instead of 10%)
    const scaleFactor = e.deltaY > 0 ? 1.05 : 0.95;
    
    const newW = currentViewBox.w * scaleFactor;
    const newH = currentViewBox.h * scaleFactor;
    const newX = currentViewBox.x - (newW - currentViewBox.w) / 2; // Zoom to center
    const newY = currentViewBox.y - (newH - currentViewBox.h) / 2;

    setManualViewBox({ x: newX, y: newY, w: newW, h: newH });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Calculate SVG units per pixel
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
        const scaleX = currentViewBox.w / svgRect.width;
        const scaleY = currentViewBox.h / svgRect.height;

        setManualViewBox({
            ...currentViewBox,
            x: currentViewBox.x - (dx * scaleX),
            y: currentViewBox.y - (dy * scaleY)
        });
        setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const zoom = (direction: 'in' | 'out') => {
      // Smooth button zoom
      const scaleFactor = direction === 'out' ? 1.2 : 0.8;
      const newW = currentViewBox.w * scaleFactor;
      const newH = currentViewBox.h * scaleFactor;
      const newX = currentViewBox.x - (newW - currentViewBox.w) / 2; 
      const newY = currentViewBox.y - (newH - currentViewBox.h) / 2;
      setManualViewBox({ x: newX, y: newY, w: newW, h: newH });
  };

  const formatValue = (val: number) => {
      if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
      return val.toString();
  };

  // Helper: Check if path A is a prefix of path B
  const isPrefix = (prefix: boolean[], fullPath: boolean[]) => {
    if (prefix.length > fullPath.length) return false;
    return prefix.every((val, i) => val === fullPath[i]);
  };

  // Determine the highlighting status of a path
  const getPathStatus = (path: boolean[]): 'best' | 'candidate' | 'none' => {
    if (bestSolutionPath && isPrefix(path, bestSolutionPath) && path.length <= bestSolutionPath.length) {
        return 'best';
    }
    const visibleCandidates = candidates.filter(c => c.stepIndex <= currentStepIndex);
    for (const cand of visibleCandidates) {
        if (isPrefix(path, cand.path) && path.length <= cand.path.length) {
            return 'candidate';
        }
    }
    return 'none';
  };

  return (
    <div 
        className="flex justify-center items-center border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden h-[500px] relative select-none"
    >
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.w} ${currentViewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={`${!isDragging ? 'transition-all duration-300 ease-out' : ''} cursor-grab active:cursor-grabbing`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
            </marker>
             <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
             <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        {/* Edges */}
        {edges.map(edge => {
           const isIncluded = edge.direction;
           const status = getPathStatus(edge.target.path);
           let strokeColor = isIncluded ? "#22c55e" : "#f97316";
           let strokeDash = isIncluded ? "0" : "5,5";
           let strokeWidth = 1.5;
           let opacity = (edge.target.status === 'pending') ? 0.2 : 0.8;

           if (status === 'best') {
              strokeColor = "#eab308"; 
              strokeDash = "0";
              strokeWidth = 3;
              opacity = 1;
           } else if (status === 'candidate') {
              strokeColor = "#fde047";
              strokeDash = "0";
              strokeWidth = 2;
              opacity = 0.6;
           }

           const midX = (edge.source.x + edge.target.x) / 2;
           const midY = (edge.source.y + edge.target.y) / 2;

           return (
            <g key={edge.id} opacity={opacity}>
               <line 
                 x1={edge.source.x} y1={edge.source.y} 
                 x2={edge.target.x} y2={edge.target.y} 
                 stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={strokeDash}
               />
               <rect 
                 x={midX - 18} y={midY - 9} width={36} height={18} rx={4}
                 fill="#0f172a" 
                 opacity={status === 'best' ? 1 : 0.85}
                 stroke={status === 'best' ? "#eab308" : (status === 'candidate' ? "#fde047" : "none")}
                 strokeWidth={status !== 'none' ? 1 : 0}
               />
               <text 
                 x={midX} y={midY} dy={4}
                 textAnchor="middle" fontSize="10" 
                 fill={status === 'best' ? "#fef08a" : (status === 'candidate' ? "#fef9c3" : (isIncluded ? "#86efac" : "#fdba74"))}
                 fontWeight="bold" style={{ pointerEvents: 'none' }}
               >
                 {isIncluded ? `+${formatValue(edge.utxoValue)}` : 'Skip'}
               </text>
            </g>
           );
        })}

        {/* Nodes */}
        {nodes.map(node => {
            let fill = "#475569";
            let stroke = "none";
            let radius = 6;
            let filter = "";
            let label = "";
            const status = getPathStatus(node.path);

            if (node.status === 'active' || (node.type === StepType.PRUNE_SUM) || (node.type === StepType.PRUNE_VAL) || (node.type === StepType.SOLUTION)) {
                radius = 10;
            }

            if (node.status === 'solution') {
                fill = "#eab308";
                stroke = "#fef08a";
                filter = "url(#glow-gold)";
                label = "SOL";
            } else if (node.status === 'pruned') {
                fill = "#ef4444";
                stroke = "#7f1d1d";
                label = "X";
            } else if (node.status === 'active') {
                fill = "#3b82f6";
                stroke = "#93c5fd";
                filter = "url(#glow-green)";
            } else if (node.status === 'visited') {
                fill = "#64748b";
            }

            if (status === 'best') {
                 stroke = "#fef08a";
                 if (node.status === 'visited') {
                    fill = "#a16207";
                    radius = 8;
                 }
                 if (node.status === 'solution' && bestSolutionPath && bestSolutionPath.length === node.path.length) {
                     radius = 14;
                 }
            } else if (status === 'candidate') {
                stroke = "#fde047";
                if (node.status === 'visited') {
                    fill = "#854d0e";
                }
                const isTip = candidates.some(c => c.stepIndex <= currentStepIndex && c.path.length === node.path.length && c.path.every((v,i) => v === node.path[i]));
                if (isTip) {
                    fill = "#facc15"; 
                    label = "SOL";
                }
            }

            return (
                <g key={node.id}>
                    {node.status === 'active' && (
                         <circle 
                            cx={node.x} cy={node.y} r={radius + 6} 
                            fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.5"
                         >
                            <animate attributeName="r" from={radius} to={radius + 12} dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                         </circle>
                    )}
                    <circle 
                        cx={node.x} cy={node.y} r={radius} 
                        fill={fill} stroke={stroke} strokeWidth={(node.status === 'active' || status !== 'none') ? 2 : 0} filter={filter}
                    />
                    {label && (
                        <text x={node.x} y={node.y} dy={4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">
                            {label}
                        </text>
                    )}
                </g>
            );
        })}
      </svg>
      
      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
        <button onClick={() => zoom('in')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors" title="Zoom In">
            <ZoomIn size={16} />
        </button>
        <button onClick={() => zoom('out')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors" title="Zoom Out">
            <ZoomOut size={16} />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1"></div>
        <button 
            onClick={() => setManualViewBox(null)} 
            className={`p-1.5 rounded transition-colors flex items-center gap-2 ${!manualViewBox ? 'text-blue-400 bg-blue-900/20' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
            title="Auto-Fit"
        >
            <Maximize size={16} />
            {!manualViewBox && <span className="text-[10px] font-bold pr-1">AUTO</span>}
        </button>
      </div>
    </div>
  );
};