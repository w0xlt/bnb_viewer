import { Utxo, AlgorithmStep, StepType, Scenario, SolutionCandidate } from '../types';

// Simulating a simplified version of Bitcoin Core's BnB
// Bitcoin Core does NOT stop at the first solution. 
// It continues searching to find the solution with the lowest "waste" (best fee/input optimization).

export const generateScenario = (
  utxoValues: number[],
  target: number,
  dustThreshold: number = 0
): Scenario => {
  // 1. Prepare UTXOs (Sort Descending)
  const utxos: Utxo[] = utxoValues
    .sort((a, b) => b - a)
    .map((val, idx) => ({ id: `utxo-${idx}`, value: val }));

  const steps: AlgorithmStep[] = [];
  const candidates: SolutionCandidate[] = [];
  let stepCounter = 0;
  let foundAnySolution = false;
  let bestSolutionIndices: number[] | undefined = undefined;
  let bestSolutionPath: boolean[] | undefined = undefined;

  // Helper to calculate sum of remaining UTXOs starting from an index
  const getRemainingSum = (startIndex: number) => {
    let sum = 0;
    for (let i = startIndex; i < utxos.length; i++) {
      sum += utxos[i].value;
    }
    return sum;
  };

  const recordStep = (
    type: StepType,
    depth: number,
    idx: number,
    selection: number[],
    sum: number,
    desc: string,
    path: boolean[]
  ) => {
    steps.push({
      stepId: stepCounter++,
      type,
      depth,
      utxoIndex: idx,
      currentSelection: [...selection],
      currentSum: sum,
      description: desc,
      remainingValue: getRemainingSum(idx + 1),
      path: [...path],
    });
  };

  const backtrack = (
    depth: number,
    currentSelection: number[],
    currentSum: number,
    startIndex: number,
    path: boolean[]
  ) => {
    // Note: In Core, there is an iteration limit (e.g. 100k tries). 
    // We omit it here for small N visualization.

    // Check for solution
    if (currentSum === target || (currentSum > target && currentSum <= target + dustThreshold)) {
      foundAnySolution = true;
      bestSolutionIndices = [...currentSelection]; // Keep track of the latest valid solution
      bestSolutionPath = [...path];
      
      // Record this candidate
      candidates.push({
          path: [...path],
          stepIndex: stepCounter, // Matches the ID of the step about to be recorded
          value: currentSum
      });
      
      recordStep(
        StepType.SOLUTION,
        depth,
        startIndex - 1,
        currentSelection,
        currentSum,
        `Candidate Solution found! Sum: ${currentSum}. Core records this and continues searching for lower waste.`,
        path
      );
      
      // CRITICAL: Do NOT return here. 
      // Bitcoin Core updates 'best_selection' and continues backtracking to find potentially better solutions.
      // However, since we can't go deeper in this specific branch (adding more adds value), we effectively backtrack.
      return;
    }
    
    // If we've run out of UTXOs
    if (startIndex >= utxos.length) {
      recordStep(StepType.BACKTRACK, depth, startIndex, currentSelection, currentSum, "End of branch reached. Backtracking.", path);
      return;
    }

    const currentUtxo = utxos[startIndex];
    const remaining = getRemainingSum(startIndex);

    // Pruning Condition 1: Even if we take everything remaining, we can't reach target
    if (currentSum + remaining < target) {
      recordStep(
        StepType.PRUNE_SUM,
        depth,
        startIndex,
        currentSelection,
        currentSum,
        `Pruned: Current (${currentSum}) + Remaining (${remaining}) < Target (${target})`,
        path
      );
      return;
    }

    // Pruning Condition 2: Current sum already exceeds target + range
    if (currentSum > target + dustThreshold) {
       recordStep(
        StepType.PRUNE_VAL,
        depth,
        startIndex,
        currentSelection,
        currentSum,
        `Pruned: Current (${currentSum}) exceeds Target + Tolerance`,
        path
      );
      return;
    }

    // --- BRANCH LEFT (INCLUDE) ---
    recordStep(
        StepType.INCLUDE,
        depth,
        startIndex,
        [...currentSelection, startIndex],
        currentSum + currentUtxo.value,
        `Checking UTXO #${startIndex} (${currentUtxo.value}): INCLUDED`,
        [...path, true]
    );
    
    backtrack(
      depth + 1, 
      [...currentSelection, startIndex], 
      currentSum + currentUtxo.value, 
      startIndex + 1,
      [...path, true]
    );
    

    // --- BRANCH RIGHT (EXCLUDE) ---
    recordStep(
        StepType.EXCLUDE,
        depth,
        startIndex,
        currentSelection,
        currentSum,
        `Backtracking. Now checking UTXO #${startIndex} (${currentUtxo.value}): EXCLUDED`,
        [...path, false]
    );

    backtrack(
      depth + 1, 
      currentSelection, 
      currentSum, 
      startIndex + 1,
      [...path, false]
    );
  };

  // Start the recursion
  backtrack(0, [], 0, 0, []);
  
  // Add COMPLETE step at the very end
  recordStep(StepType.COMPLETE, 0, 0, [], 0, foundAnySolution ? "Search Complete. Best solution returned." : "Search Complete. No solution found.", []);

  return {
    utxos,
    target,
    steps,
    outcome: foundAnySolution ? 'success' : 'failure',
    bestSolutionIndices,
    bestSolutionPath,
    candidates
  };
};