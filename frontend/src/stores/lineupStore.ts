import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormationType, LineupPlayer, Player, PositionType } from '../types';

export const TOTAL_BUDGET = 100.0;
export const MAX_SQUAD_SIZE = 15;
export const MAX_PLAYERS_PER_CLUB = 3;

export interface TargetSlotInfo {
  position: PositionType;
  slotIndex?: number;
  isBench?: boolean;
}

export interface LineupStoreState {
  startingXI: LineupPlayer[];
  bench: LineupPlayer[];
  formation: FormationType;
  captainId: number | null;
  viceCaptainId: number | null;
  targetSlot: TargetSlotInfo | null;
  notification: string | null;

  // Actions
  setFormation: (formation: FormationType) => void;
  setCaptain: (id: number) => void;
  setViceCaptain: (id: number) => void;
  setTargetSlot: (slot: TargetSlotInfo | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  removePlayer: (id: number) => void;
  addPlayerToLineup: (player: Player) => boolean;
  loadSampleLineup: (startingXI: LineupPlayer[], bench: LineupPlayer[]) => void;
  resetLineup: () => void;

  // Getters / Selectors
  getTotalCost: () => number;
  getRemainingBudget: () => number;
  getTotalPlayers: () => number;
  getSelectedPlayerIds: () => number[];
  validateLineup: () => {
    isValid: boolean;
    errors: string[];
  };
}

export const useLineupStore = create<LineupStoreState>()(
  persist(
    (set, get) => ({
      startingXI: [],
      bench: [],
      formation: '4-3-3',
      captainId: null,
      viceCaptainId: null,
      targetSlot: null,
      notification: null,

      showToast: (msg: string) => {
        set({ notification: msg });
      },

      clearToast: () => {
        set({ notification: null });
      },

      setTargetSlot: (slot: TargetSlotInfo | null) => {
        set({ targetSlot: slot });
      },

      setCaptain: (id: number) => {
        const { startingXI, viceCaptainId, showToast } = get();
        const player = startingXI.find((p) => p.id === id);
        if (!player) {
          showToast('Chỉ có thể chọn Captain từ 11 cầu thủ đá chính!');
          return;
        }

        const newStarting = startingXI.map((p) => ({
          ...p,
          isCaptain: p.id === id,
          isViceCaptain: p.id === id ? false : p.isViceCaptain,
        }));

        set({
          startingXI: newStarting,
          captainId: id,
          viceCaptainId: viceCaptainId === id ? null : viceCaptainId,
        });
        showToast(`Đã chọn ${player.web_name} làm Captain (x2 điểm)!`);
      },

      setViceCaptain: (id: number) => {
        const { startingXI, captainId, showToast } = get();
        const player = startingXI.find((p) => p.id === id);
        if (!player) {
          showToast('Chỉ có thể chọn Vice-Captain từ 11 cầu thủ đá chính!');
          return;
        }

        const newStarting = startingXI.map((p) => ({
          ...p,
          isViceCaptain: p.id === id,
          isCaptain: p.id === id ? false : p.isCaptain,
        }));

        set({
          startingXI: newStarting,
          viceCaptainId: id,
          captainId: captainId === id ? null : captainId,
        });
        showToast(`Đã chọn ${player.web_name} làm Vice-Captain!`);
      },

      setFormation: (newForm: FormationType) => {
        const { startingXI, bench, showToast } = get();
        const [newDefCount, newMidCount, newFwdCount] = newForm.split('-').map(Number);

        const gkp = startingXI.find((p) => p.element_type === 'GKP') || null;
        const benchGkp = bench.find((p) => p.element_type === 'GKP') || null;

        const allDefs = [
          ...startingXI.filter((p) => p.element_type === 'DEF'),
          ...bench.filter((p) => p.element_type === 'DEF'),
        ];
        const allMids = [
          ...startingXI.filter((p) => p.element_type === 'MID'),
          ...bench.filter((p) => p.element_type === 'MID'),
        ];
        const allFwds = [
          ...startingXI.filter((p) => p.element_type === 'FWD'),
          ...bench.filter((p) => p.element_type === 'FWD'),
        ];

        const newStartingDefs = allDefs.slice(0, newDefCount).map((p, idx) => ({
          ...p,
          isStarting: true,
          slotIndex: idx,
        }));
        const excessDefs = allDefs.slice(newDefCount);

        const newStartingMids = allMids.slice(0, newMidCount).map((p, idx) => ({
          ...p,
          isStarting: true,
          slotIndex: idx,
        }));
        const excessMids = allMids.slice(newMidCount);

        const newStartingFwds = allFwds.slice(0, newFwdCount).map((p, idx) => ({
          ...p,
          isStarting: true,
          slotIndex: idx,
        }));
        const excessFwds = allFwds.slice(newFwdCount);

        const newStartingXI: LineupPlayer[] = [
          ...(gkp ? [{ ...gkp, isStarting: true, slotIndex: 0 }] : []),
          ...newStartingDefs,
          ...newStartingMids,
          ...newStartingFwds,
        ];

        const excessOutfield = [...excessDefs, ...excessMids, ...excessFwds];
        const newBench: LineupPlayer[] = [
          ...(benchGkp ? [{ ...benchGkp, isStarting: false, slotIndex: 0 }] : []),
          ...excessOutfield.slice(0, 3).map((p, idx) => ({
            ...p,
            isStarting: false,
            slotIndex: idx + 1,
          })),
        ];

        set({
          formation: newForm,
          startingXI: newStartingXI,
          bench: newBench,
        });
        showToast(`Đã chuyển sang sơ đồ ${newForm}!`);
      },

      removePlayer: (id: number) => {
        const { startingXI, bench, captainId, viceCaptainId, showToast } = get();
        const removed = [...startingXI, ...bench].find((p) => p.id === id);

        set({
          startingXI: startingXI.filter((p) => p.id !== id),
          bench: bench.filter((p) => p.id !== id),
          captainId: captainId === id ? null : captainId,
          viceCaptainId: viceCaptainId === id ? null : viceCaptainId,
        });

        if (removed) {
          showToast(`Đã bỏ ${removed.web_name} khỏi đội hình`);
        }
      },

      addPlayerToLineup: (player: Player): boolean => {
        const {
          startingXI,
          bench,
          targetSlot,
          formation,
          getRemainingBudget,
          getSelectedPlayerIds,
          showToast,
        } = get();

        const selectedPlayerIds = getSelectedPlayerIds();
        const totalPlayers = startingXI.length + bench.length;
        const remainingBudget = getRemainingBudget();

        // 1. Kiểm tra đã chọn chưa
        if (selectedPlayerIds.includes(player.id)) {
          showToast(`${player.web_name} đã có trong đội hình!`);
          return false;
        }

        // 2. Kiểm tra giới hạn 3 cầu thủ / 1 CLB (Rule #6 - kiểm tra trước)
        const clubCount = [...startingXI, ...bench].filter((p) => p.team_id === player.team_id).length;
        if (clubCount >= MAX_PLAYERS_PER_CLUB) {
          showToast(`Đã đạt tối đa 3 cầu thủ từ CLB này!`);
          return false;
        }

        // 3. Kiểm tra ngân sách (Rule #5)
        if (remainingBudget < player.now_cost) {
          showToast(
            `Không đủ ngân sách! Cần £${player.now_cost.toFixed(1)}m, còn lại £${remainingBudget.toFixed(1)}m.`
          );
          return false;
        }

        // 4. Kiểm tra target slot
        const isTargeting = !!targetSlot;
        const slotIdx = targetSlot ? (targetSlot.slotIndex ?? 0) : 0;

        const isReplacing =
          isTargeting &&
          (!targetSlot.isBench
            ? startingXI.some((p) => p.element_type === targetSlot.position && p.slotIndex === slotIdx)
            : bench.some((p) => p.slotIndex === slotIdx));

        if (!isReplacing && totalPlayers >= MAX_SQUAD_SIZE) {
          showToast(`Đội hình đã đủ tối đa 15 cầu thủ! Vui lòng xóa bớt trước khi thêm.`);
          return false;
        }

        const newLineupPlayer: LineupPlayer = {
          ...player,
          isStarting: targetSlot ? !targetSlot.isBench : true,
          isCaptain: false,
          isViceCaptain: false,
          slotIndex: slotIdx,
        };

        // TRƯỜNG HỢP A: Nhắm ô cụ thể
        if (targetSlot) {
          if (player.element_type !== targetSlot.position) {
            showToast(
              `Cầu thủ này là ${player.element_type}, không thể xếp vào vị trí ${targetSlot.position}!`
            );
            return false;
          }

          if (!targetSlot.isBench) {
            const updatedStarting = startingXI.filter(
              (p) => !(p.element_type === targetSlot.position && p.slotIndex === slotIdx)
            );
            set({
              startingXI: [...updatedStarting, newLineupPlayer],
              targetSlot: null,
            });
          } else {
            const updatedBench = bench.filter((p) => p.slotIndex !== slotIdx);
            set({
              bench: [...updatedBench, newLineupPlayer],
              targetSlot: null,
            });
          }

          showToast(
            `Đã xếp ${player.web_name} vào đúng vị trí ${targetSlot.position} ô số ${slotIdx + 1} ${
              targetSlot.isBench ? 'dự bị' : 'đá chính'
            }!`
          );
          return true;
        }

        // TRƯỜNG HỢP B: Tự do
        const [defMax, midMax, fwdMax] = formation.split('-').map(Number);

        if (player.element_type === 'GKP') {
          const hasStartingGkp = startingXI.some((p) => p.element_type === 'GKP');
          if (!hasStartingGkp) {
            set({
              startingXI: [
                ...startingXI.filter((p) => p.element_type !== 'GKP'),
                { ...newLineupPlayer, slotIndex: 0, isStarting: true },
              ],
            });
            showToast(`Đã thêm thủ môn ${player.web_name} vào đội hình chính!`);
            return true;
          } else {
            const hasBenchGkp = bench.some((p) => p.element_type === 'GKP');
            if (!hasBenchGkp) {
              set({
                bench: [
                  ...bench.filter((p) => p.element_type !== 'GKP'),
                  { ...newLineupPlayer, slotIndex: 0, isStarting: false },
                ],
              });
              showToast(`Đã thêm thủ môn dự bị ${player.web_name}!`);
              return true;
            } else {
              showToast(`Đội hình đã có đủ 2 Thủ môn (1 chính, 1 dự bị)!`);
              return false;
            }
          }
        }

        const posMax = player.element_type === 'DEF' ? defMax : player.element_type === 'MID' ? midMax : fwdMax;
        const occupiedStartingSlots = new Set(
          startingXI.filter((p) => p.element_type === player.element_type).map((p) => p.slotIndex)
        );
        let freeStartingSlot = -1;
        for (let i = 0; i < posMax; i++) {
          if (!occupiedStartingSlots.has(i)) {
            freeStartingSlot = i;
            break;
          }
        }

        if (freeStartingSlot !== -1) {
          set({
            startingXI: [
              ...startingXI,
              { ...newLineupPlayer, slotIndex: freeStartingSlot, isStarting: true },
            ],
          });
          showToast(
            `Đã thêm ${player.web_name} vào vị trí ${player.element_type} ô ${freeStartingSlot + 1} chính thức!`
          );
          return true;
        }

        const occupiedBenchSlots = new Set(bench.map((p) => p.slotIndex));
        let freeBenchSlot = -1;
        for (let s = 1; s <= 3; s++) {
          if (!occupiedBenchSlots.has(s)) {
            freeBenchSlot = s;
            break;
          }
        }

        if (freeBenchSlot !== -1) {
          set({
            bench: [
              ...bench,
              { ...newLineupPlayer, slotIndex: freeBenchSlot, isStarting: false },
            ],
          });
          showToast(
            `Hàng ${player.element_type} chính đã đủ. Đã xếp ${player.web_name} vào ghế dự bị Sub ${freeBenchSlot}!`
          );
          return true;
        }

        showToast(`Hàng ${player.element_type} và ghế dự bị đã đủ chỗ!`);
        return false;
      },

      loadSampleLineup: (sampleStarting: LineupPlayer[], sampleBench: LineupPlayer[]) => {
        const captain = sampleStarting.find((p) => p.isCaptain);
        const viceCaptain = sampleStarting.find((p) => p.isViceCaptain);

        set({
          startingXI: sampleStarting,
          bench: sampleBench,
          captainId: captain ? captain.id : null,
          viceCaptainId: viceCaptain ? viceCaptain.id : null,
          targetSlot: null,
        });
      },

      resetLineup: () => {
        set({
          startingXI: [],
          bench: [],
          captainId: null,
          viceCaptainId: null,
          targetSlot: null,
        });
        get().showToast('Đã đặt lại toàn bộ đội hình!');
      },

      // Selectors
      getTotalCost: () => {
        const { startingXI, bench } = get();
        const cost = [...startingXI, ...bench].reduce((sum, p) => sum + p.now_cost, 0);
        return Math.round(cost * 10) / 10;
      },

      getRemainingBudget: () => {
        const total = get().getTotalCost();
        return Math.round((TOTAL_BUDGET - total) * 10) / 10;
      },

      getTotalPlayers: () => {
        const { startingXI, bench } = get();
        return startingXI.length + bench.length;
      },

      getSelectedPlayerIds: () => {
        const { startingXI, bench } = get();
        return [...startingXI, ...bench].map((p) => p.id);
      },

      validateLineup: () => {
        const { startingXI, bench, captainId, viceCaptainId, formation } = get();
        const errors: string[] = [];

        // Rule 1: Tổng số 15 cầu thủ
        const totalCount = startingXI.length + bench.length;
        if (totalCount !== MAX_SQUAD_SIZE) {
          errors.push(`Đội hình cần đủ 15 cầu thủ (hiện có ${totalCount}/15).`);
        }

        if (startingXI.length !== 11) {
          errors.push(`Đội hình đá chính phải có đúng 11 cầu thủ (hiện có ${startingXI.length}).`);
        }

        if (bench.length !== 4) {
          errors.push(`Ghế dự bị phải có đúng 4 cầu thủ (hiện có ${bench.length}).`);
        }

        // Rule 2: Ngân sách <= 100m
        const totalCost = get().getTotalCost();
        if (totalCost > TOTAL_BUDGET) {
          errors.push(`Tổng giá trị đội hình (£${totalCost.toFixed(1)}m) vượt quá ngân sách cho phép (£${TOTAL_BUDGET.toFixed(1)}m).`);
        }

        // Rule 3: Tối đa 3 cầu thủ / 1 CLB
        const clubMap: Record<number, number> = {};
        [...startingXI, ...bench].forEach((p) => {
          clubMap[p.team_id] = (clubMap[p.team_id] || 0) + 1;
        });
        Object.entries(clubMap).forEach(([clubId, count]) => {
          if (count > MAX_PLAYERS_PER_CLUB) {
            errors.push(`CLB ID ${clubId} có ${count} cầu thủ (tối đa 3 cầu thủ/CLB).`);
          }
        });

        // Rule 4: Cấu trúc vị trí FPL (2 GKP, 5 DEF, 5 MID, 3 FWD trong 15 cầu thủ)
        const allPlayers = [...startingXI, ...bench];
        const gkpCount = allPlayers.filter((p) => p.element_type === 'GKP').length;
        const defCount = allPlayers.filter((p) => p.element_type === 'DEF').length;
        const midCount = allPlayers.filter((p) => p.element_type === 'MID').length;
        const fwdCount = allPlayers.filter((p) => p.element_type === 'FWD').length;

        if (gkpCount !== 2) errors.push(`Cần đúng 2 Thủ môn GKP (hiện có ${gkpCount}).`);
        if (defCount !== 5) errors.push(`Cần đúng 5 Hậu vệ DEF (hiện có ${defCount}).`);
        if (midCount !== 5) errors.push(`Cần đúng 5 Tiền vệ MID (hiện có ${midCount}).`);
        if (fwdCount !== 3) errors.push(`Cần đúng 3 Tiền đạo FWD (hiện có ${fwdCount}).`);

        // Rule 5: Formation đội hình chính
        const [targetDef, targetMid, targetFwd] = formation.split('-').map(Number);
        const startingDef = startingXI.filter((p) => p.element_type === 'DEF').length;
        const startingMid = startingXI.filter((p) => p.element_type === 'MID').length;
        const startingFwd = startingXI.filter((p) => p.element_type === 'FWD').length;

        if (startingDef !== targetDef || startingMid !== targetMid || startingFwd !== targetFwd) {
          errors.push(`Đội hình chính không khớp sơ đồ ${formation} (${startingDef}-${startingMid}-${startingFwd}).`);
        }

        // Rule 6: Phải có Captain và Vice-Captain
        if (!captainId) {
          errors.push('Chưa chọn Captain (Đội trưởng x2 điểm).');
        }
        if (!viceCaptainId) {
          errors.push('Chưa chọn Vice-Captain (Đội phó).');
        }
        if (captainId && viceCaptainId && captainId === viceCaptainId) {
          errors.push('Captain và Vice-Captain không thể là cùng một cầu thủ.');
        }

        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    }),
    {
      name: 'fpl_lineup_storage_v1',
      // An toàn khi chạy trong Node/SSR/Vitest môi trường không có window.localStorage
      storage: typeof window !== 'undefined' && window.localStorage
        ? {
            getItem: (name) => {
              const str = window.localStorage.getItem(name);
              return str ? JSON.parse(str) : null;
            },
            setItem: (name, val) => {
              window.localStorage.setItem(name, JSON.stringify(val));
            },
            removeItem: (name) => {
              window.localStorage.removeItem(name);
            },
          }
        : undefined,
      partialize: (state) => ({
        startingXI: state.startingXI,
        bench: state.bench,
        formation: state.formation,
        captainId: state.captainId,
        viceCaptainId: state.viceCaptainId,
      }),
    }
  )
);
