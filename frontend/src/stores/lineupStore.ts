import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormationType, LineupPlayer, Player, PositionType } from '../types';

export const TOTAL_BUDGET = 100.0;
export const MAX_SQUAD_SIZE = 15;
export const MAX_PLAYERS_PER_CLUB = 3;

export const MAX_FREE_TRANSFERS = 3;

export const FORMATIONS: FormationType[] = ['4-3-3', '3-4-3', '3-5-2', '4-4-2', '4-5-1', '5-3-2', '5-4-1', '5-2-3'];

function lineupFormation(xi: LineupPlayer[]): FormationType | undefined {
  if (xi.length !== 11 || xi.filter(p => p.element_type === 'GKP').length !== 1) return;
  const shape = ['DEF', 'MID', 'FWD'].map(pos => xi.filter(p => p.element_type === pos).length).join('-');
  return FORMATIONS.find(formation => formation === shape);
}

export function substitutionFormation(xi: LineupPlayer[], incoming: LineupPlayer, outgoingId: number) {
  if (xi.some(p => p.id === incoming.id) || !xi.some(p => p.id === outgoingId)) return;
  return lineupFormation(xi.map(p => p.id === outgoingId ? incoming : p));
}

export interface TransferCalculationResult {
  playersOut: LineupPlayer[];
  playersIn: LineupPlayer[];
  transfersCount: number; // Số lượt đang đổi trong phiên này
  totalTransfers: number; // Tổng số lượt tuần này (đã dùng + đang đổi)
  transfersMadeThisWeek: number; // Số lượt đã chốt tuần này
  remainingTransfers: number; // Số lượt miễn phí còn lại
  netCostDiff: number; // Chênh lệch ngân sách (inCost - outCost)
}

/**
 * Thuật toán tính toán số lượt chuyển nhượng độc lập giữa Đội hình hiện tại, Đội hình gốc,
 * và số lượt đã chốt trong Gameweek hiện tại.
 */
export function calculateTransfers(
  currentSquad: LineupPlayer[],
  baselineSquad: LineupPlayer[],
  transfersMadeThisWeek: number = 0
): TransferCalculationResult {
  const currentIds = new Set(currentSquad.map((p) => p.id));
  const baselineIds = new Set(baselineSquad.map((p) => p.id));

  const playersOut = baselineSquad.filter((p) => !currentIds.has(p.id));
  const playersIn = currentSquad.filter((p) => !baselineIds.has(p.id));

  // Mỗi lượt thay người là 1 cặp (bán 1 cầu thủ cũ & mua 1 cầu thủ mới)
  const transfersCount = Math.max(playersOut.length, playersIn.length);
  const totalTransfers = transfersMadeThisWeek + transfersCount;
  const remainingTransfers = Math.max(0, MAX_FREE_TRANSFERS - totalTransfers);

  const outCost = playersOut.reduce((sum, p) => sum + p.now_cost, 0);
  const inCost = playersIn.reduce((sum, p) => sum + p.now_cost, 0);
  const netCostDiff = Math.round((inCost - outCost) * 10) / 10;

  return {
    playersOut,
    playersIn,
    transfersCount,
    totalTransfers,
    transfersMadeThisWeek,
    remainingTransfers,
    netCostDiff,
  };
}

export interface TargetSlotInfo {
  position: PositionType;
  slotIndex?: number;
  isBench?: boolean;
}

export interface LineupStoreState {
  startingXI: LineupPlayer[];
  bench: LineupPlayer[];
  baselineSquad: LineupPlayer[];
  transfersMadeThisWeek: number;
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
  substitutePlayer: (incomingId: number, outgoingId: number) => void;
  addPlayerToLineup: (player: Player) => boolean;
  loadSampleLineup: (startingXI: LineupPlayer[], bench: LineupPlayer[]) => void;
  resetLineup: () => void;
  setBaselineSquad: (squad: LineupPlayer[]) => void;
  commitTransfers: (deadline: number) => boolean;
  resetToBaseline: () => void;
  transferWeek: number | null;
  syncTransferWeek: (deadline: number) => void;

  // Getters / Selectors
  getTotalCost: () => number;
  getRemainingBudget: () => number;
  getTotalPlayers: () => number;
  getSelectedPlayerIds: () => number[];
  getTransferSummary: () => TransferCalculationResult;
  validateLineup: () => {
    isValid: boolean;
    errors: string[];
  };
}

type PersistedLineup = Pick<LineupStoreState,
  'startingXI' | 'bench' | 'formation' | 'captainId' | 'viceCaptainId'
>;

export const useLineupStore = create<LineupStoreState>()(
  persist<LineupStoreState, [], [], PersistedLineup>(
    (set, get) => ({
      startingXI: [],
      bench: [],
      transferWeek: null,
      baselineSquad: [],
      transfersMadeThisWeek: 0,
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

      substitutePlayer: (incomingId, outgoingId) => {
        const { startingXI, bench, captainId, viceCaptainId } = get();
        const incoming = bench.find(p => p.id === incomingId);
        const outgoing = startingXI.find(p => p.id === outgoingId);
        if (!incoming || !outgoing) return;
        const formation = substitutionFormation(startingXI, incoming, outgoingId);
        if (!formation) return;
        const nextCaptain = captainId === outgoingId ? incomingId : captainId;
        const nextVice = viceCaptainId === outgoingId ? incomingId : viceCaptainId;
        const nextXI = startingXI.map(p => p.id === outgoingId ? {
          ...incoming, isStarting: true, isCaptain: nextCaptain === incomingId,
          isViceCaptain: nextVice === incomingId,
          slotIndex: outgoing.element_type === incoming.element_type ? outgoing.slotIndex : 11,
        } : p);
        const slots: Record<PositionType, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
        set({
          startingXI: nextXI.sort((a, b) => a.slotIndex - b.slotIndex)
            .map(p => ({ ...p, slotIndex: slots[p.element_type]++ })),
          bench: bench.map(p => p.id === incomingId ? {
            ...outgoing, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: incoming.slotIndex,
          } : p),
          formation, captainId: nextCaptain, viceCaptainId: nextVice, targetSlot: null,
          notification: `${incoming.web_name} vào sân thay ${outgoing.web_name}.`,
        });
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
        const fullSquad = [...sampleStarting, ...sampleBench];
        const existingBaseline = get().baselineSquad;

        set({
          startingXI: sampleStarting,
          formation: lineupFormation(sampleStarting) ?? get().formation,
          bench: sampleBench,
          baselineSquad: existingBaseline.length > 0 ? existingBaseline : fullSquad,
          captainId: captain ? captain.id : null,
          viceCaptainId: viceCaptain ? viceCaptain.id : null,
          targetSlot: null,
        });
      },

      setBaselineSquad: (squad: LineupPlayer[]) => {
        set({ baselineSquad: squad });
      },

      commitTransfers: (deadline) => {
        const state = get();
        const squad = [...state.startingXI, ...state.bench];
        const summary = state.getTransferSummary();
        if (!Number.isFinite(deadline) || deadline !== state.transferWeek || Date.now() >= deadline ||
            squad.length !== MAX_SQUAD_SIZE || state.getRemainingBudget() < 0 ||
            summary.transfersCount === 0 || summary.totalTransfers > MAX_FREE_TRANSFERS) return false;

        set({ baselineSquad: squad, transfersMadeThisWeek: summary.totalTransfers });
        state.showToast(`Đã chốt chuyển nhượng. Còn lại: ${summary.remainingTransfers} / 3 lượt.`);
        return true;
      },

      syncTransferWeek: (deadline) => {
        const { transferWeek } = get();
        if (!Number.isFinite(deadline) || (transferWeek !== null && deadline <= transferWeek)) return;
        // Older saved lineups have a counter but no week identifier.
        set(transferWeek === null ? { transferWeek: deadline }
          : { transferWeek: deadline, transfersMadeThisWeek: 0 });
      },

      resetToBaseline: () => {
        const { baselineSquad, showToast } = get();
        if (baselineSquad.length === 0) return;
        const starting = baselineSquad.filter((p) => p.isStarting);
        const bench = baselineSquad.filter((p) => !p.isStarting);
        const captain = starting.find((p) => p.isCaptain) || null;
        const viceCaptain = starting.find((p) => p.isViceCaptain) || null;
        set({
          startingXI: starting,
          formation: lineupFormation(starting) ?? get().formation,
          bench: bench,
          captainId: captain ? captain.id : null,
          viceCaptainId: viceCaptain ? viceCaptain.id : null,
          targetSlot: null,
        });
        showToast('Đã khôi phục đội hình gốc trước khi chuyển nhượng!');
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
      getTransferSummary: () => {
        const { startingXI, bench, baselineSquad, transfersMadeThisWeek } = get();
        return calculateTransfers([...startingXI, ...bench], baselineSquad, transfersMadeThisWeek);
      },
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
        baselineSquad: state.baselineSquad,
        transferWeek: state.transferWeek,
        transfersMadeThisWeek: state.transfersMadeThisWeek,
      }),
    }
  )
);
