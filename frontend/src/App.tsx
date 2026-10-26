import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Trophy, 
  Users, 
  Sparkles, 
  GitCompare, 
  Wallet, 
  ShieldCheck, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { VirtualPitch } from './components/pitch/VirtualPitch';
import { PlayerTable } from './components/player-list/PlayerTable';
import { LineupPlayer, PositionType, FormationType, Player } from './types';

export type TabType = 'pitch' | 'players' | 'optimizer' | 'compare';

const INITIAL_STARTING_XI: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
  { id: 7, web_name: 'Palmer', team_id: 5, element_type: 'MID', now_cost: 10.5, total_points: 135, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 9, web_name: 'Haaland', team_id: 10, element_type: 'FWD', now_cost: 15.0, total_points: 160, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 10, web_name: 'Wood', team_id: 13, element_type: 'FWD', now_cost: 6.0, total_points: 95, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
];

const INITIAL_BENCH: LineupPlayer[] = [
  { id: 12, web_name: 'Turner', team_id: 13, element_type: 'GKP', now_cost: 4.0, total_points: 20, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 13, web_name: 'Dunk', team_id: 4, element_type: 'DEF', now_cost: 4.5, total_points: 50, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 15, web_name: 'Semenyo', team_id: 3, element_type: 'MID', now_cost: 5.5, total_points: 75, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
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
  const [activeTab, setActiveTab] = useState<TabType>('pitch');
  const [startingXI, setStartingXI] = useState<LineupPlayer[]>(INITIAL_STARTING_XI);
  const [bench, setBench] = useState<LineupPlayer[]>(INITIAL_BENCH);
  const [formation, setFormation] = useState<FormationType>('4-3-3');
  const [notification, setNotification] = useState<string | null>(null);
  const [targetSlot, setTargetSlot] = useState<{
    position: PositionType;
    slotIndex?: number;
    isBench?: boolean;
  } | null>(null);

  // Parse current formation counts
  const [defMax, midMax, fwdMax] = formation.split('-').map(Number);

  // Calculate live squad stats
  const totalCost = [...startingXI, ...bench].reduce((sum, p) => sum + p.now_cost, 0);
  const totalBudget = 100.0;
  const remainingBudget = totalBudget - totalCost;
  const totalPlayers = startingXI.length + bench.length;
  const selectedPlayerIds = [...startingXI, ...bench].map(p => p.id);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSelectCaptain = (id: number) => {
    setStartingXI(prev => prev.map(p => ({
      ...p,
      isCaptain: p.id === id,
      isViceCaptain: p.id === id ? false : p.isViceCaptain,
    })));
  };

  const handleSelectViceCaptain = (id: number) => {
    setStartingXI(prev => prev.map(p => ({
      ...p,
      isViceCaptain: p.id === id,
      isCaptain: p.id === id ? false : p.isCaptain,
    })));
  };

  const handleFormationChange = (newForm: FormationType) => {
    setFormation(newForm);
    const [newDefCount, newMidCount, newFwdCount] = newForm.split('-').map(Number);

    // GKP: 1 chính (slot 0), 1 phụ (slot 0)
    const gkp = startingXI.find(p => p.element_type === 'GKP') || null;
    const benchGkp = bench.find(p => p.element_type === 'GKP') || null;

    // Gom toàn bộ DEF, MID, FWD hiện có trong cả startingXI và bench
    const allDefs = [
      ...startingXI.filter(p => p.element_type === 'DEF'),
      ...bench.filter(p => p.element_type === 'DEF'),
    ];
    const allMids = [
      ...startingXI.filter(p => p.element_type === 'MID'),
      ...bench.filter(p => p.element_type === 'MID'),
    ];
    const allFwds = [
      ...startingXI.filter(p => p.element_type === 'FWD'),
      ...bench.filter(p => p.element_type === 'FWD'),
    ];

    // 1. Phân bổ Hậu vệ (DEF)
    const newStartingDefs = allDefs.slice(0, newDefCount).map((p, idx) => ({
      ...p,
      isStarting: true,
      slotIndex: idx,
    }));
    const excessDefs = allDefs.slice(newDefCount);

    // 2. Phân bổ Tiền vệ (MID)
    const newStartingMids = allMids.slice(0, newMidCount).map((p, idx) => ({
      ...p,
      isStarting: true,
      slotIndex: idx,
    }));
    const excessMids = allMids.slice(newMidCount);

    // 3. Phân bổ Tiền đạo (FWD)
    const newStartingFwds = allFwds.slice(0, newFwdCount).map((p, idx) => ({
      ...p,
      isStarting: true,
      slotIndex: idx,
    }));
    const excessFwds = allFwds.slice(newFwdCount);

    // Ghép lại Starting XI (đá chính)
    const newStartingXI: LineupPlayer[] = [
      ...(gkp ? [{ ...gkp, isStarting: true, slotIndex: 0 }] : []),
      ...newStartingDefs,
      ...newStartingMids,
      ...newStartingFwds,
    ];

    // Ghép lại Bench (dự bị) - tối đa 3 cầu thủ outfield, slotIndex từ 1..3
    const excessOutfield = [...excessDefs, ...excessMids, ...excessFwds];
    const newBench: LineupPlayer[] = [
      ...(benchGkp ? [{ ...benchGkp, isStarting: false, slotIndex: 0 }] : []),
      ...excessOutfield.slice(0, 3).map((p, idx) => ({
        ...p,
        isStarting: false,
        slotIndex: idx + 1,
      })),
    ];

    setStartingXI(newStartingXI);
    setBench(newBench);
    showToast(`Đã chuyển sang sơ đồ ${newForm}!`);
  };

  const handleRemovePlayer = (id: number) => {
    const removed = [...startingXI, ...bench].find(p => p.id === id);
    setStartingXI(prev => prev.filter(p => p.id !== id));
    setBench(prev => prev.filter(p => p.id !== id));
    if (removed) {
      showToast(`Đã bỏ ${removed.web_name} khỏi đội hình`);
    }
  };

  const handleAddPlayerClick = (position: PositionType, slotIndex?: number, isBench?: boolean) => {
    setTargetSlot({ position, slotIndex, isBench: !!isBench });
    setActiveTab('players');
  };

  const handleSelectPlayerFromMarket = (player: Player) => {
    // 1. Kiểm tra cầu thủ đã có trong đội hình chưa
    if (selectedPlayerIds.includes(player.id)) {
      showToast(`${player.web_name} đã có trong đội hình!`);
      return;
    }

    // 2. Kiểm tra xem ô targetSlot này đã có cầu thủ nào chiếm chưa
    const isTargeting = !!targetSlot;
    const isReplacing = isTargeting && (
      !targetSlot.isBench
        ? startingXI.some(p => p.element_type === targetSlot.position && p.slotIndex === targetSlot.slotIndex)
        : bench.some(p => p.slotIndex === targetSlot.slotIndex)
    );

    // Nếu không phải đang thay thế 1 cầu thủ có sẵn, và tổng số cầu thủ đã đạt tối đa 15
    if (!isReplacing && totalPlayers >= 15) {
      showToast(`Đội hình đã đủ tối đa 15 cầu thủ! Vui lòng xóa bớt trước khi thêm.`);
      return;
    }

    // 3. Kiểm tra ngân sách
    if (remainingBudget < player.now_cost) {
      showToast(`Không đủ ngân sách! Cần £${player.now_cost.toFixed(1)}m, còn lại £${remainingBudget.toFixed(1)}m.`);
      return;
    }

    // 4. Kiểm tra giới hạn 3 cầu thủ / CLB
    const clubCount = [...startingXI, ...bench].filter(p => p.team_id === player.team_id).length;
    if (clubCount >= 3) {
      showToast(`Đã đạt tối đa 3 cầu thủ từ CLB này!`);
      return;
    }

    const slotIdx = targetSlot ? (targetSlot.slotIndex ?? 0) : 0;
    const newLineupPlayer: LineupPlayer = {
      ...player,
      isStarting: targetSlot ? !targetSlot.isBench : true,
      isCaptain: false,
      isViceCaptain: false,
      slotIndex: slotIdx,
    };

    // TRƯỜNG HỢP A: Người dùng bấm chọn trực tiếp vào một ô vị trí cụ thể trên sân hoặc bench
    if (targetSlot) {
      if (player.element_type !== targetSlot.position) {
        showToast(`Cầu thủ này là ${player.element_type}, không thể xếp vào vị trí ${targetSlot.position}!`);
        return;
      }

      if (!targetSlot.isBench) {
        // Đặt chính xác vào ô slotIndex của hàng vị trí này
        const updatedStarting = startingXI.filter(
          p => !(p.element_type === targetSlot.position && p.slotIndex === slotIdx)
        );
        setStartingXI([...updatedStarting, newLineupPlayer]);
      } else {
        // Ghế dự bị: đặt chính xác vào ô slotIndex trên bench
        const updatedBench = bench.filter(p => p.slotIndex !== slotIdx);
        setBench([...updatedBench, newLineupPlayer]);
      }

      setTargetSlot(null);
      setActiveTab('pitch'); // Tự động quay lại xem sân bóng
      showToast(`Đã xếp ${player.web_name} vào đúng vị trí ${targetSlot.position} ô số ${slotIdx + 1} ${targetSlot.isBench ? 'dự bị' : 'đá chính'}!`);
      return;
    }

    // TRƯỜNG HỢP B: Người dùng chọn tự do từ bảng cầu thủ mà chưa bấm slot trên sân
    if (player.element_type === 'GKP') {
      const hasStartingGkp = startingXI.some(p => p.element_type === 'GKP');
      if (!hasStartingGkp) {
        setStartingXI(prev => [...prev.filter(p => p.element_type !== 'GKP'), { ...newLineupPlayer, slotIndex: 0, isStarting: true }]);
        setActiveTab('pitch');
        showToast(`Đã thêm thủ môn ${player.web_name} vào đội hình chính!`);
      } else {
        const hasBenchGkp = bench.some(p => p.element_type === 'GKP');
        if (!hasBenchGkp) {
          setBench(prev => [...prev.filter(p => p.element_type !== 'GKP'), { ...newLineupPlayer, slotIndex: 0, isStarting: false }]);
          setActiveTab('pitch');
          showToast(`Đã thêm thủ môn dự bị ${player.web_name}!`);
        } else {
          showToast(`Đội hình đã có đủ 2 Thủ môn (1 chính, 1 dự bị)!`);
        }
      }
      return;
    }

    // Tìm slotIndex còn trống đầu tiên cho DEF, MID hoặc FWD
    const posMax = player.element_type === 'DEF' ? defMax : player.element_type === 'MID' ? midMax : fwdMax;
    const occupiedStartingSlots = new Set(
      startingXI.filter(p => p.element_type === player.element_type).map(p => p.slotIndex)
    );
    let freeStartingSlot = -1;
    for (let i = 0; i < posMax; i++) {
      if (!occupiedStartingSlots.has(i)) {
        freeStartingSlot = i;
        break;
      }
    }

    if (freeStartingSlot !== -1) {
      setStartingXI(prev => [...prev, { ...newLineupPlayer, slotIndex: freeStartingSlot, isStarting: true }]);
      setActiveTab('pitch');
      showToast(`Đã thêm ${player.web_name} vào vị trí ${player.element_type} ô ${freeStartingSlot + 1} chính thức!`);
      return;
    }

    // Nếu hàng chính thức đã đủ, tìm slot trống trên ghế dự bị (slot 1..3)
    const occupiedBenchSlots = new Set(bench.map(p => p.slotIndex));
    let freeBenchSlot = -1;
    for (let s = 1; s <= 3; s++) {
      if (!occupiedBenchSlots.has(s)) {
        freeBenchSlot = s;
        break;
      }
    }

    if (freeBenchSlot !== -1) {
      setBench(prev => [...prev, { ...newLineupPlayer, slotIndex: freeBenchSlot, isStarting: false }]);
      setActiveTab('pitch');
      showToast(`Hàng ${player.element_type} chính đã đủ. Đã xếp ${player.web_name} vào ghế dự bị Sub ${freeBenchSlot}!`);
      return;
    }

    showToast(`Hàng ${player.element_type} và ghế dự bị đã đủ chỗ!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-fpl-green selection:text-fpl-purple">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2 animate-bounce">
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-purple-900/40 bg-[#240029]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fpl-purple to-fpl-magenta flex items-center justify-center shadow-lg shadow-purple-950/50 border border-fpl-green/30">
              <Trophy className="w-5 h-5 text-fpl-green" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
                FPL LINEUP <span className="text-fpl-green font-black">BUILDER</span>
              </h1>
              <p className="text-xs text-purple-300/70 hidden sm:block">AI-Powered Fantasy Premier League Optimizer</p>
            </div>
          </div>

          {/* Quick Lineup Status Widgets */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 hidden sm:inline">Ngân sách:</span>
              <span className={`font-bold ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                £{remainingBudget.toFixed(1)}m
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">£{totalBudget.toFixed(1)}m</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400 hidden sm:inline">Đội hình:</span>
              <span className={`font-bold ${totalPlayers === 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalPlayers}/15
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 border-t border-purple-900/30">
          <button
            onClick={() => setActiveTab('pitch')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'pitch'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sân Bóng (Pitch View)</span>
          </button>

          <button
            onClick={() => setActiveTab('players')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Thị Trường Cầu Thủ (Player Table)</span>
          </button>

          <button
            onClick={() => setActiveTab('optimizer')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'optimizer'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Bộ Tối Ưu (Optimizer)</span>
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'compare'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <GitCompare className="w-4 h-4 text-fpl-cyan" />
            <span>So Sánh (Compare)</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'pitch' && (
          <section className="space-y-4">
            <div className="bg-gradient-to-r from-purple-950/60 to-slate-900/60 border border-purple-800/30 rounded-2xl p-4 sm:p-6 backdrop-blur shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-fpl-green" />
                    Đội hình thi đấu chính thức (Gameweek)
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Chọn đủ 15 cầu thủ (11 đá chính, 4 dự bị) trong ngân sách £100.0m và tối đa 3 người/CLB.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('players')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all"
                >
                  <span>Chợ cầu thủ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Integrated VirtualPitch Component */}
              <VirtualPitch
                startingXI={startingXI}
                bench={bench}
                formation={formation}
                onFormationChange={handleFormationChange}
                onSelectCaptain={handleSelectCaptain}
                onSelectViceCaptain={handleSelectViceCaptain}
                onRemovePlayer={handleRemovePlayer}
                onAddPlayerClick={handleAddPlayerClick}
              />
            </div>
          </section>
        )}

        {activeTab === 'players' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-fpl-cyan" />
                  Thị Trường Chuyển Nhượng Cầu Thủ Premier League
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
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

        {activeTab === 'optimizer' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">Bộ Tối Ưu Hóa Đội Hình (PuLP Solver)</h2>
            <p className="text-sm text-slate-400">
              Khu vực tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">OptimizerControl</code> từ Task <strong>P1-NG05</strong>.
            </p>
          </section>
        )}

        {activeTab === 'compare' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">So Sánh Đội Hình (Radar Chart)</h2>
            <p className="text-sm text-slate-400">
              Khu vực tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">LineupComparisonView</code> từ Task <strong>P1-NG05</strong>.
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 mt-auto text-center text-xs text-slate-500">
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
