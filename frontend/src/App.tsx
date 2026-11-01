import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Trophy, 
  Users, 
  Sparkles, 
  GitCompare, 
  Wallet, 
  ShieldCheck, 
  Layers,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { VirtualPitch } from './components/pitch/VirtualPitch';
import { PlayerTable } from './components/player-list/PlayerTable';
import { OptimizerControl, OptimizerConfig, OptimizerResult } from './components/optimizer/OptimizerControl';
import { LineupComparisonView } from './components/comparison/LineupComparisonView';
import { FixturesPanel } from './components/fixtures/FixturesPanel';
import { PositionType, Player, LineupPlayer, FormationType } from './types';
import { useLineupStore, TOTAL_BUDGET } from './stores/lineupStore';
import { useMediaQuery } from './hooks/useMediaQuery';

export type TabType = 'pitch' | 'players' | 'optimizer' | 'compare';

const INITIAL_STARTING_XI: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, expected_points_next: 3.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, expected_points_next: 4.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, expected_points_next: 4.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, expected_points_next: 3.0, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, expected_points_next: 3.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, expected_points_next: 6.5, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
  { id: 7, web_name: 'Palmer', team_id: 5, element_type: 'MID', now_cost: 10.5, total_points: 135, expected_points_next: 7.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, expected_points_next: 4.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 9, web_name: 'Haaland', team_id: 10, element_type: 'FWD', now_cost: 15.0, total_points: 160, expected_points_next: 8.8, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 10, web_name: 'Wood', team_id: 13, element_type: 'FWD', now_cost: 6.0, total_points: 95, expected_points_next: 5.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, expected_points_next: 4.0, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
];

const INITIAL_BENCH: LineupPlayer[] = [
  { id: 12, web_name: 'Turner', team_id: 13, element_type: 'GKP', now_cost: 4.0, total_points: 20, expected_points_next: 1.0, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 13, web_name: 'Dunk', team_id: 4, element_type: 'DEF', now_cost: 4.5, total_points: 50, expected_points_next: 2.8, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, expected_points_next: 3.8, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 15, web_name: 'Semenyo', team_id: 3, element_type: 'MID', now_cost: 5.5, total_points: 75, expected_points_next: 4.5, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
];

export const SAMPLE_MARKET_PLAYERS: Player[] = [
  { id: 1, web_name: 'Flekken', first_name: 'Mark', second_name: 'Flekken', team_id: 3, team_short_name: 'BRE', element_type: 'GKP', now_cost: 4.5, total_points: 88, form: 4.2, expected_points_next: 3.5, status: 'a' },
  { id: 2, web_name: 'Saliba', first_name: 'William', second_name: 'Saliba', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 85, form: 5.0, expected_points_next: 4.5, status: 'a' },
  { id: 3, web_name: 'Gabriel', first_name: 'Gabriel', second_name: 'Magalhaes', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 82, form: 4.8, expected_points_next: 4.2, status: 'a' },
  { id: 4, web_name: 'Konsa', first_name: 'Ezri', second_name: 'Konsa', team_id: 2, team_short_name: 'AVL', element_type: 'DEF', now_cost: 4.5, total_points: 55, form: 3.5, expected_points_next: 3.0, status: 'a' },
  { id: 5, web_name: 'Robinson', first_name: 'Antonee', second_name: 'Robinson', team_id: 9, team_short_name: 'FUL', element_type: 'DEF', now_cost: 4.5, total_points: 60, form: 4.0, expected_points_next: 3.2, status: 'a' },
  { id: 6, web_name: 'Saka', first_name: 'Bukayo', second_name: 'Saka', team_id: 1, team_short_name: 'ARS', element_type: 'MID', now_cost: 10.0, total_points: 120, form: 6.8, expected_points_next: 6.5, status: 'a' },
  { id: 7, web_name: 'Palmer', first_name: 'Cole', second_name: 'Palmer', team_id: 5, team_short_name: 'CHE', element_type: 'MID', now_cost: 10.5, total_points: 135, form: 7.5, expected_points_next: 7.2, status: 'a' },
  { id: 8, web_name: 'Rogers', first_name: 'Morgan', second_name: 'Rogers', team_id: 2, team_short_name: 'AVL', element_type: 'MID', now_cost: 5.0, total_points: 70, form: 5.2, expected_points_next: 4.5, status: 'a' },
  { id: 9, web_name: 'Haaland', first_name: 'Erling', second_name: 'Haaland', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 15.0, total_points: 160, form: 8.5, expected_points_next: 8.8, status: 'a' },
  { id: 10, web_name: 'Wood', first_name: 'Chris', second_name: 'Wood', team_id: 13, team_short_name: 'NFO', element_type: 'FWD', now_cost: 6.0, total_points: 95, form: 6.0, expected_points_next: 5.5, status: 'a' },
  { id: 11, web_name: 'Delap', first_name: 'Liam', second_name: 'Delap', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 5.5, total_points: 80, form: 4.5, expected_points_next: 4.0, status: 'a' },
  { id: 12, web_name: 'Turner', first_name: 'Matt', second_name: 'Turner', team_id: 13, team_short_name: 'NFO', element_type: 'GKP', now_cost: 4.0, total_points: 20, form: 1.0, expected_points_next: 1.0, status: 's' },
  { id: 13, web_name: 'Dunk', first_name: 'Lewis', second_name: 'Dunk', team_id: 4, team_short_name: 'BHA', element_type: 'DEF', now_cost: 4.5, total_points: 50, form: 3.2, expected_points_next: 2.8, status: 'a' },
  { id: 14, web_name: 'Smith Rowe', first_name: 'Emile', second_name: 'Smith Rowe', team_id: 9, team_short_name: 'FUL', element_type: 'MID', now_cost: 5.5, total_points: 65, form: 4.0, expected_points_next: 3.8, status: 'a' },
  { id: 15, web_name: 'Semenyo', first_name: 'Antoine', second_name: 'Semenyo', team_id: 3, team_short_name: 'BRE', element_type: 'MID', now_cost: 5.5, total_points: 75, form: 5.0, expected_points_next: 4.5, status: 'a' },
  { id: 16, web_name: 'Salah', first_name: 'Mohamed', second_name: 'Salah', team_id: 9, team_short_name: 'LIV', element_type: 'MID', now_cost: 12.8, total_points: 170, form: 8.8, expected_points_next: 8.5, status: 'a' },
  { id: 17, web_name: 'Son', first_name: 'Heung-Min', second_name: 'Son', team_id: 14, team_short_name: 'TOT', element_type: 'MID', now_cost: 9.8, total_points: 110, form: 6.2, expected_points_next: 6.0, status: 'd' },
  { id: 18, web_name: 'Watkins', first_name: 'Ollie', second_name: 'Watkins', team_id: 2, team_short_name: 'AVL', element_type: 'FWD', now_cost: 9.0, total_points: 125, form: 6.5, expected_points_next: 6.2, status: 'a' },
  { id: 19, web_name: 'Isak', first_name: 'Alexander', second_name: 'Isak', team_id: 12, team_short_name: 'NEW', element_type: 'FWD', now_cost: 8.5, total_points: 115, form: 7.0, expected_points_next: 6.8, status: 'a' },
  { id: 20, web_name: 'Alexander-Arnold', first_name: 'Trent', second_name: 'Alexander-Arnold', team_id: 9, team_short_name: 'LIV', element_type: 'DEF', now_cost: 7.2, total_points: 98, form: 5.5, expected_points_next: 5.8, status: 'a' },
  { id: 21, web_name: 'Gvardiol', first_name: 'Josko', second_name: 'Gvardiol', team_id: 10, team_short_name: 'MCI', element_type: 'DEF', now_cost: 6.1, total_points: 92, form: 5.8, expected_points_next: 5.2, status: 'a' },
  { id: 22, web_name: 'Raya', first_name: 'David', second_name: 'Raya', team_id: 1, team_short_name: 'ARS', element_type: 'GKP', now_cost: 5.5, total_points: 102, form: 5.0, expected_points_next: 4.8, status: 'a' },
  { id: 23, web_name: 'Pickford', first_name: 'Jordan', second_name: 'Pickford', team_id: 7, team_short_name: 'EVE', element_type: 'GKP', now_cost: 4.9, total_points: 85, form: 4.5, expected_points_next: 4.0, status: 'a' },
  { id: 24, web_name: 'Mbeumo', first_name: 'Bryan', second_name: 'Mbeumo', team_id: 3, team_short_name: 'BRE', element_type: 'MID', now_cost: 7.6, total_points: 108, form: 6.4, expected_points_next: 5.9, status: 'a' },
  { id: 25, web_name: 'Bruno Fernandes', first_name: 'Bruno', second_name: 'Fernandes', team_id: 11, team_short_name: 'MUN', element_type: 'MID', now_cost: 8.2, total_points: 96, form: 5.2, expected_points_next: 5.5, status: 'a' },
];

export function App() {
  const isSplit = useMediaQuery('(min-width: 1280px)');
  const [activeTab, setActiveTab] = useState<TabType>('pitch');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizedResult, setOptimizedResult] = useState<OptimizerResult | null>(null);

  // Zustand Store Hooks
  const {
    startingXI,
    bench,
    formation,
    targetSlot,
    notification,
    setFormation,
    setCaptain,
    setViceCaptain,
    setTargetSlot,
    removePlayer,
    addPlayerToLineup,
    loadSampleLineup,
    resetLineup,
    showToast,
    clearToast,
    getTotalCost,
    getRemainingBudget,
    getTotalPlayers,
    getSelectedPlayerIds,
    validateLineup,
  } = useLineupStore();

  // Khởi tạo sample lineup lần đầu nếu store rỗng
  useEffect(() => {
    if (startingXI.length === 0 && bench.length === 0) {
      loadSampleLineup(INITIAL_STARTING_XI, INITIAL_BENCH);
    }
  }, []);

  // Tự động chuyển tab 'players' sang 'pitch' khi màn hình lớn chia đôi
  useEffect(() => {
    if (isSplit && activeTab === 'players') {
      setActiveTab('pitch');
    }
  }, [isSplit, activeTab]);

  // Tự tắt Toast sau 3 giây
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearToast]);

  const totalCost = getTotalCost();
  const remainingBudget = getRemainingBudget();
  const totalPlayers = getTotalPlayers();
  const selectedPlayerIds = getSelectedPlayerIds();
  const validation = validateLineup();

  const handleAddPlayerClick = (position: PositionType, slotIndex?: number, isBench?: boolean) => {
    setTargetSlot({ position, slotIndex, isBench: !!isBench });
    if (!isSplit) {
      setActiveTab('players');
    }
  };

  const handleSelectPlayerFromMarket = (player: Player) => {
    const success = addPlayerToLineup(player);
    if (success) {
      setActiveTab('pitch');
    }
  };

  // Thuật toán duyệt tối ưu có ràng buộc (Constrained Knapsack Optimizer)
  const handleRunOptimizer = async (config: OptimizerConfig): Promise<OptimizerResult | null> => {
    setIsOptimizing(true);
    await new Promise((resolve) => setTimeout(resolve, 600)); // Giả lập độ trễ tính toán

    const selectedForm: FormationType = config.targetFormation === 'auto' ? '3-4-3' : config.targetFormation;
    const [defCount, midCount, fwdCount] = selectedForm.split('-').map(Number);

    // 1. Lọc danh sách ứng viên (bỏ excluded)
    const pool = SAMPLE_MARKET_PLAYERS.filter((p) => !config.excludedPlayerIds.includes(p.id));
    const locked = pool.filter((p) => config.lockedPlayerIds.includes(p.id));
    const lockedCost = locked.reduce((s, p) => s + p.now_cost, 0);

    if (lockedCost > config.budget) {
      setIsOptimizing(false);
      showToast('Không khả thi: Cầu thủ đã khóa vượt quá ngân sách đã chọn!');
      return null;
    }

    const lockedClubs: Record<number, number> = {};
    for (const p of locked) {
      lockedClubs[p.team_id] = (lockedClubs[p.team_id] || 0) + 1;
      if (lockedClubs[p.team_id] > 3) {
        setIsOptimizing(false);
        showToast('Không khả thi: Các cầu thủ đã khóa có hơn 3 người cùng thuộc 1 CLB!');
        return null;
      }
    }

    const lockedByPos = {
      GKP: locked.filter((p) => p.element_type === 'GKP'),
      DEF: locked.filter((p) => p.element_type === 'DEF'),
      MID: locked.filter((p) => p.element_type === 'MID'),
      FWD: locked.filter((p) => p.element_type === 'FWD'),
    };

    if (
      lockedByPos.GKP.length > 2 ||
      lockedByPos.DEF.length > 5 ||
      lockedByPos.MID.length > 5 ||
      lockedByPos.FWD.length > 3
    ) {
      setIsOptimizing(false);
      showToast('Không khả thi: Số cầu thủ khóa vượt quá hạn mức vị trí (2 GKP, 5 DEF, 5 MID, 3 FWD)!');
      return null;
    }

    const remCandidates = pool.filter((p) => !config.lockedPlayerIds.includes(p.id));
    const remByPos = {
      GKP: remCandidates.filter((p) => p.element_type === 'GKP'),
      DEF: remCandidates.filter((p) => p.element_type === 'DEF'),
      MID: remCandidates.filter((p) => p.element_type === 'MID'),
      FWD: remCandidates.filter((p) => p.element_type === 'FWD'),
    };

    const getCombinations = <T,>(arr: T[], k: number): T[][] => {
      if (k === 0) return [[]];
      if (arr.length < k) return [];
      const head = arr[0];
      const tail = arr.slice(1);
      return [
        ...getCombinations(tail, k - 1).map((c) => [head, ...c]),
        ...getCombinations(tail, k),
      ];
    };

    const gkpCombs = getCombinations(remByPos.GKP, 2 - lockedByPos.GKP.length).map((c) => ({
      players: [...lockedByPos.GKP, ...c],
      cost: [...lockedByPos.GKP, ...c].reduce((s, p) => s + p.now_cost, 0),
      xp: [...lockedByPos.GKP, ...c].reduce((s, p) => s + (p.expected_points_next ?? 4), 0),
      clubs: [...lockedByPos.GKP, ...c].map((p) => p.team_id),
    }));

    const defCombs = getCombinations(remByPos.DEF, 5 - lockedByPos.DEF.length).map((c) => ({
      players: [...lockedByPos.DEF, ...c],
      cost: [...lockedByPos.DEF, ...c].reduce((s, p) => s + p.now_cost, 0),
      xp: [...lockedByPos.DEF, ...c].reduce((s, p) => s + (p.expected_points_next ?? 4), 0),
      clubs: [...lockedByPos.DEF, ...c].map((p) => p.team_id),
    }));

    const midCombs = getCombinations(remByPos.MID, 5 - lockedByPos.MID.length).map((c) => ({
      players: [...lockedByPos.MID, ...c],
      cost: [...lockedByPos.MID, ...c].reduce((s, p) => s + p.now_cost, 0),
      xp: [...lockedByPos.MID, ...c].reduce((s, p) => s + (p.expected_points_next ?? 4), 0),
      clubs: [...lockedByPos.MID, ...c].map((p) => p.team_id),
    }));

    const fwdCombs = getCombinations(remByPos.FWD, 3 - lockedByPos.FWD.length).map((c) => ({
      players: [...lockedByPos.FWD, ...c],
      cost: [...lockedByPos.FWD, ...c].reduce((s, p) => s + p.now_cost, 0),
      xp: [...lockedByPos.FWD, ...c].reduce((s, p) => s + (p.expected_points_next ?? 4), 0),
      clubs: [...lockedByPos.FWD, ...c].map((p) => p.team_id),
    }));

    let bestSquad: { players: Player[]; cost: number; xp: number } | null = null;
    let maxXP = -1;

    for (const g of gkpCombs) {
      for (const d of defCombs) {
        if (g.cost + d.cost > config.budget - 30) continue;
        for (const f of fwdCombs) {
          if (g.cost + d.cost + f.cost > config.budget - 20) continue;
          for (const m of midCombs) {
            const totalCost = g.cost + d.cost + f.cost + m.cost;
            if (totalCost > config.budget + 1e-5) continue;

            // Kiểm tra tối đa 3 cầu thủ mỗi CLB
            const clubMap: Record<number, number> = {};
            let validClub = true;
            for (const cid of [...g.clubs, ...d.clubs, ...f.clubs, ...m.clubs]) {
              clubMap[cid] = (clubMap[cid] || 0) + 1;
              if (clubMap[cid] > 3) {
                validClub = false;
                break;
              }
            }
            if (!validClub) continue;

            const totalXP = g.xp + d.xp + f.xp + m.xp;
            if (totalXP > maxXP) {
              maxXP = totalXP;
              bestSquad = {
                players: [...g.players, ...d.players, ...m.players, ...f.players],
                cost: Math.round(totalCost * 10) / 10,
                xp: Math.round(totalXP * 10) / 10,
              };
            }
          }
        }
      }
    }

    if (!bestSquad) {
      setIsOptimizing(false);
      showToast('Không tìm thấy đội hình thỏa mãn ngân sách này. Vui lòng tăng ngân sách hoặc bỏ bớt cầu thủ khóa!');
      return null;
    }

    // Phân bổ 15 cầu thủ thành Starting XI và Bench theo sơ đồ
    const gkps = bestSquad.players
      .filter((p) => p.element_type === 'GKP')
      .sort((a, b) => (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0));
    const defs = bestSquad.players
      .filter((p) => p.element_type === 'DEF')
      .sort((a, b) => (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0));
    const mids = bestSquad.players
      .filter((p) => p.element_type === 'MID')
      .sort((a, b) => (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0));
    const fwds = bestSquad.players
      .filter((p) => p.element_type === 'FWD')
      .sort((a, b) => (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0));

    const startingDefs = defs.slice(0, defCount);
    const benchDefs = defs.slice(defCount);

    const startingMids = mids.slice(0, midCount);
    const benchMids = mids.slice(midCount);

    const startingFwds = fwds.slice(0, fwdCount);
    const benchFwds = fwds.slice(fwdCount);

    const startingXIResult: LineupPlayer[] = [
      { ...gkps[0], isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
      ...startingDefs.map((p, idx) => ({
        ...p,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: idx,
      })),
      ...startingMids.map((p, idx) => ({
        ...p,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: idx,
      })),
      ...startingFwds.map((p, idx) => ({
        ...p,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: idx,
      })),
    ];

    const benchSubs = [...benchDefs, ...benchMids, ...benchFwds];
    const benchResult: LineupPlayer[] = [
      { ...gkps[1], isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
      ...benchSubs.slice(0, 3).map((p, idx) => ({
        ...p,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: idx + 1,
      })),
    ];

    // Chọn Captain (xP cao nhất Starting XI) và Vice-Captain (xP cao nhì)
    const sortedStarters = [...startingXIResult].sort(
      (a, b) => (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0)
    );
    const captainId = sortedStarters[0]?.id;
    const viceCaptainId = sortedStarters[1]?.id;

    const result: OptimizerResult = {
      status: 'optimal',
      total_cost: bestSquad.cost,
      total_expected_points: bestSquad.xp,
      starting_xi: startingXIResult,
      bench: benchResult,
      captain_id: captainId,
      vice_captain_id: viceCaptainId,
      formation: selectedForm,
    };

    setOptimizedResult(result);
    setIsOptimizing(false);
    showToast('Đã tìm thấy đội hình tối ưu hoàn hảo trong ngân sách!');
    setActiveTab('compare');
    return result;
  };

  const handleApplyOptimizedLineup = () => {
    if (!optimizedResult) return;

    if (optimizedResult.total_cost > 100.0) {
      showToast('Không thể áp dụng: Đội hình tối ưu vượt quá ngân sách £100.0m cho phép!');
      return;
    }

    loadSampleLineup(optimizedResult.starting_xi, optimizedResult.bench);
    setFormation(optimizedResult.formation);
    setCaptain(optimizedResult.captain_id);
    setViceCaptain(optimizedResult.vice_captain_id);
    showToast('Đã áp dụng đội hình tối ưu của AI vào Sân bóng thành công!');
    setActiveTab('pitch');
  };
  const currentFullSquad = [...startingXI, ...bench];
  const optimizedFullSquad = optimizedResult ? [...optimizedResult.starting_xi, ...optimizedResult.bench] : [];

  return (
    <div className="min-h-screen bg-brand-dark text-brand-white flex flex-col font-sans selection:bg-brand-hotpink-dark selection:text-brand-white">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-brand-skyblue text-brand-darker font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-brand-skyblue-light flex items-center gap-2 animate-toast-in">
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-brand-border bg-brand-darker/80 backdrop-blur-md sticky top-0 z-40">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between ${isSplit ? "max-w-screen-2xl" : "max-w-7xl"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-lg shadow-brand-darker/50 border border-brand-skyblue/30">
              <Trophy className="w-5 h-5 text-brand-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
                FPL LINEUP <span className="text-brand-skyblue-light font-black">BUILDER</span>
              </h1>
              <p className="text-xs text-brand-muted hidden sm:block">AI-Powered Fantasy Premier League Optimizer</p>
            </div>
          </div>

          {/* Quick Lineup Status Widgets (FPL Pill Design: Bank & Players selected) */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            {/* Bank Pill */}
            <div className="flex items-center bg-brand-darker/90 border border-brand-border rounded-full p-1 pr-3 shadow-inner">
              <div className="w-7 h-7 rounded-full bg-brand-skyblue/15 border border-brand-skyblue/30 flex items-center justify-center mr-2 text-brand-skyblue-light">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-brand-muted font-bold leading-none">Bank</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`font-extrabold text-xs sm:text-sm leading-none ${remainingBudget >= 0 ? 'text-brand-skyblue-light' : 'text-brand-hotpink-light'}`}>
                    £{remainingBudget.toFixed(1)}m
                  </span>
                  <span className="text-[10px] text-brand-muted leading-none">/ £{TOTAL_BUDGET.toFixed(1)}m</span>
                </div>
              </div>
            </div>

            {/* Players Selected Pill */}
            <div className="flex items-center bg-brand-darker/90 border border-brand-border rounded-full p-1 pr-3 shadow-inner">
              <div className="w-7 h-7 rounded-full bg-brand-hotpink/15 border border-brand-hotpink/30 flex items-center justify-center mr-2 text-brand-hotpink-light">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider text-brand-muted font-bold leading-none">Players</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`font-extrabold text-xs sm:text-sm leading-none ${totalPlayers === 15 ? 'text-brand-skyblue-light' : 'text-brand-hotpink-light'}`}>
                    {totalPlayers}
                  </span>
                  <span className="text-[10px] text-brand-muted leading-none">/ 15</span>
                </div>
              </div>
            </div>

            {/* Reset button */}
            <button
              onClick={() => resetLineup()}
              className="p-2 rounded-full bg-brand-darker/90 hover:bg-brand-hotpink-dark/30 border border-brand-border hover:border-brand-hotpink/50 text-brand-muted hover:text-brand-hotpink-light transition-all shadow-sm active:scale-95"
              title="Đặt lại đội hình"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 border-t border-brand-border/60 ${isSplit ? "max-w-screen-2xl" : "max-w-7xl"}`}>
          <button
            onClick={() => setActiveTab('pitch')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'pitch'
                ? 'border-brand-skyblue text-brand-skyblue-light bg-brand-skyblue/10'
                : 'border-transparent text-brand-muted hover:text-brand-white hover:bg-brand-card/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sân Bóng (Pitch View)</span>
          </button>

          {!isSplit && (
          <button
            onClick={() => setActiveTab('players')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'border-brand-skyblue text-brand-skyblue-light bg-brand-skyblue/10'
                : 'border-transparent text-brand-muted hover:text-brand-white hover:bg-brand-card/40'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Thị Trường Cầu Thủ (Player Table)</span>
          </button>
          )}

          <button
            onClick={() => setActiveTab('optimizer')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'optimizer'
                ? 'border-brand-skyblue text-brand-skyblue-light bg-brand-skyblue/10'
                : 'border-transparent text-brand-muted hover:text-brand-white hover:bg-brand-card/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-brand-skyblue-light" />
            <span>Bộ Tối Ưu (Optimizer)</span>
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'compare'
                ? 'border-brand-skyblue text-brand-skyblue-light bg-brand-skyblue/10'
                : 'border-transparent text-brand-muted hover:text-brand-white hover:bg-brand-card/40'
            }`}
          >
            <GitCompare className="w-4 h-4 text-brand-skyblue-light" />
            <span>So Sánh (Compare)</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full ${isSplit ? "max-w-screen-2xl" : "max-w-7xl"}`}>
        {/* Warning Banner if Lineup has validation errors */}
        {!validation.isValid && totalPlayers > 0 && (
          <div className="mb-4 bg-brand-hotpink/10 border border-brand-hotpink/30 rounded-xl p-3 text-xs sm:text-sm text-brand-hotpink-light flex items-start gap-2.5 shadow-lg">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-brand-hotpink" />
            <div>
              <p className="font-bold">Đội hình chưa hoàn tất yêu cầu của FPL:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-brand-white/80">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab Sân Bóng */}
        {activeTab === 'pitch' && (
          <section className="space-y-4">
            <div className="bg-gradient-to-r from-brand-card/80 to-brand-darker/80 border border-brand-border rounded-2xl p-4 sm:p-6 backdrop-blur shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-skyblue-light" />
                    Đội hình thi đấu chính thức (Gameweek)
                  </h2>
                  <p className="text-brand-muted text-sm mt-1">
                    Chọn đủ 15 cầu thủ (11 đá chính, 4 dự bị) trong ngân sách £100.0m và tối đa 3 người/CLB. Tự động lưu LocalStorage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadSampleLineup(INITIAL_STARTING_XI, INITIAL_BENCH)}
                    className="px-3 py-2 rounded-xl bg-brand-card hover:bg-brand-card-hover text-brand-white text-xs font-semibold border border-brand-skyblue/40 transition-colors"
                  >
                    Tải mẫu FPL
                  </button>
                  <button
                    onClick={() => setActiveTab('optimizer')}
                    className="px-3.5 py-2 rounded-xl bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-hotpink/20 hover:brightness-110 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 fill-brand-white" />
                    <span>Auto-Optimize</span>
                  </button>
                  {!isSplit && (
                  <button
                    onClick={() => setActiveTab('players')}
                    className="px-4 py-2 rounded-xl bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-brand-hotpink/20 hover:brightness-110 transition-all"
                  >
                    <span>Chợ cầu thủ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  )}
                </div>
              </div>

              {/* Integrated VirtualPitch Component (Chia đôi 2 cột khi isSplit >= 1280px) */}
              {isSplit ? (
                <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-6 items-start">
                  {/* Cột trái: Bảng thị trường cầu thủ sticky */}
                  <div className="sticky top-20 max-h-[calc(100vh-6.5rem)] overflow-y-auto pr-1 space-y-3">
                    <div className="border-b border-brand-border pb-2 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-brand-white flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-skyblue-light" />
                        <span>Player Selection</span>
                      </h3>
                      <span className="text-[11px] text-brand-muted">Chọn max 3/CLB</span>
                    </div>
                    <PlayerTable
                      players={SAMPLE_MARKET_PLAYERS}
                      selectedPlayerIds={selectedPlayerIds}
                      targetSlot={targetSlot}
                      onCancelTargetSlot={() => setTargetSlot(null)}
                      onSelectPlayer={handleSelectPlayerFromMarket}
                      variant="compact"
                    />
                  </div>

                  {/* Cột phải: Sân bóng ảo */}
                  <div className="min-w-0">
                    <VirtualPitch
                      startingXI={startingXI}
                      bench={bench}
                      formation={formation}
                      onFormationChange={setFormation}
                      onSelectCaptain={setCaptain}
                      onSelectViceCaptain={setViceCaptain}
                      onRemovePlayer={removePlayer}
                      onAddPlayerClick={handleAddPlayerClick}
                    />
                  </div>
                </div>
              ) : (
                <VirtualPitch
                  startingXI={startingXI}
                  bench={bench}
                  formation={formation}
                  onFormationChange={setFormation}
                  onSelectCaptain={setCaptain}
                  onSelectViceCaptain={setViceCaptain}
                  onRemovePlayer={removePlayer}
                  onAddPlayerClick={handleAddPlayerClick}
                />
              )}
            </div>

            {/* Bảng Fixtures Ngoại Hạng Anh bên dưới sân */}
            <FixturesPanel />
          </section>
        )}

        {/* Tab Thị Trường Cầu Thủ */}
        {activeTab === 'players' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-skyblue-light" />
                  Thị Trường Chuyển Nhượng Cầu Thủ Premier League
                </h2>
                <p className="text-sm text-brand-muted mt-0.5">
                  Lọc theo vị trí, CLB, tìm kiếm tên tức thì và bấm <strong>+ Chọn</strong> để đưa vào đội hình.
                </p>
              </div>
            </div>

            {/* Integrated PlayerTable Component from Task P1-NG03 */}
            <PlayerTable
              players={SAMPLE_MARKET_PLAYERS}
              selectedPlayerIds={selectedPlayerIds}
              targetSlot={targetSlot}
              onCancelTargetSlot={() => setTargetSlot(null)}
              onSelectPlayer={handleSelectPlayerFromMarket}
            />
          </section>
        )}

        {/* Tab Bộ Tối Ưu Hóa (Optimizer) */}
        {activeTab === 'optimizer' && (
          <section className="space-y-4">
            <OptimizerControl
              availablePlayers={SAMPLE_MARKET_PLAYERS}
              currentSquad={currentFullSquad}
              onOptimize={handleRunOptimizer}
              isOptimizing={isOptimizing}
            />
          </section>
        )}

        {/* Tab So Sánh Đội Hình (Compare) */}
        {activeTab === 'compare' && (
          <section className="space-y-4">
            <LineupComparisonView
              lineupA={{
                title: 'Đội Hình Của Bạn',
                players: currentFullSquad,
              }}
              lineupB={{
                title: optimizedResult ? 'Đội Hình Tối Ưu (AI Solver)' : 'Đội Hình Mẫu FPL Stars',
                players: optimizedResult ? optimizedFullSquad : [...INITIAL_STARTING_XI, ...INITIAL_BENCH],
              }}
              onApplyLineupB={optimizedResult ? handleApplyOptimizedLineup : undefined}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border bg-brand-darker/80 py-4 mt-auto text-center text-xs text-brand-muted">
        <p>Fantasy Football Lineup Builder & Optimizer • Cloud Computing Project 2026</p>
      </footer>
    </div>
  );
}

// Auto mount to DOM if running as standalone entrypoint
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
}
