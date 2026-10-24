export type PositionType = 'GKP' | 'DEF' | 'MID' | 'FWD';

export type FormationType = '4-3-3' | '3-4-3' | '3-5-2' | '4-4-2' | '4-5-1' | '5-3-2' | '5-4-1' | '5-2-3';

export interface Player {
  id: number;
  first_name?: string;
  second_name?: string;
  web_name: string;
  team_id: number;
  team_short_name?: string;
  element_type: PositionType;
  now_cost: number;
  total_points: number;
  form?: number;
  status?: string;
  expected_points_next?: number;
}

export interface Team {
  id: number;
  name: string;
  short_name: string;
  strength: number;
}

export interface LineupPlayer extends Player {
  isStarting: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  slotIndex: number;
}

export interface LineupState {
  startingXI: (LineupPlayer | null)[];
  bench: (LineupPlayer | null)[];
  captainId: number | null;
  viceCaptainId: number | null;
  formation: FormationType;
  totalCost: number;
  remainingBudget: number;
}

