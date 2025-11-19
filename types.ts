export interface Utxo {
  id: string;
  value: number; // in satoshis
}

export enum StepType {
  START = 'START',
  INCLUDE = 'INCLUDE',
  EXCLUDE = 'EXCLUDE',
  PRUNE_VAL = 'PRUNE_VAL', // Exceeded target + range
  PRUNE_SUM = 'PRUNE_SUM', // Remaining < Target
  SOLUTION = 'SOLUTION',
  BACKTRACK = 'BACKTRACK',
  COMPLETE = 'COMPLETE'
}

export interface AlgorithmStep {
  stepId: number;
  type: StepType;
  depth: number;
  utxoIndex: number; // The index of the UTXO being considered
  currentSelection: number[]; // Indices of selected UTXOs
  currentSum: number;
  description: string;
  remainingValue: number;
  path: boolean[]; // Path taken in the tree (true=left/include, false=right/exclude)
}

export interface SolutionCandidate {
  path: boolean[];
  stepIndex: number;
  value: number;
}

export interface Scenario {
  utxos: Utxo[];
  target: number;
  steps: AlgorithmStep[];
  outcome: 'success' | 'failure';
  bestSolutionIndices?: number[];
  bestSolutionPath?: boolean[];
  candidates?: SolutionCandidate[];
}