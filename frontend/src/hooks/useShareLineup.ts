import { useState, useCallback } from 'react';
import { useLineupStore } from '../stores/lineupStore';
import { apiClient } from '../services/apiClient';
import { FormationType, LineupPlayer } from '../types';

export interface ShareLineupPayload {
  lineup_name: string;
  starting_player_ids: number[];
  bench_player_ids: number[];
  formation: FormationType;
  captain_id: number;
  vice_captain_id: number;
}

export interface ShareLineupResponse {
  share_code: string;
  lineup_name: string;
  total_cost: number;
  predicted_points: number;
  created_at?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage: string | null;
  payload: ShareLineupPayload | null;
}

/**
 * Pure validator function for squad readiness before sharing.
 */
export function validateLineupForShare(
  startingXI: (LineupPlayer | null)[],
  bench: (LineupPlayer | null)[],
  captainId: number | null,
  viceCaptainId: number | null,
  formation: FormationType,
  customName?: string
): ValidationResult {
  const startingPlayers = startingXI.filter((p): p is LineupPlayer => p !== null);
  if (startingPlayers.length !== 11) {
    return {
      isValid: false,
      errorMessage: 'Đội hình chính cần đủ 11 cầu thủ trước khi chia sẻ.',
      payload: null,
    };
  }

  const benchPlayers = bench.filter((p): p is LineupPlayer => p !== null);
  if (benchPlayers.length !== 4) {
    return {
      isValid: false,
      errorMessage: 'Hàng ghế dự bị cần đủ 4 cầu thủ trước khi chia sẻ.',
      payload: null,
    };
  }

  if (!captainId || !viceCaptainId) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng chọn Captain (C) và Vice-Captain (V) trước khi chia sẻ.',
      payload: null,
    };
  }

  if (captainId === viceCaptainId) {
    return {
      isValid: false,
      errorMessage: 'Captain và Vice-Captain không được trùng nhau.',
      payload: null,
    };
  }

  const startingPlayerIds = startingPlayers.map((p) => p.id);
  const benchPlayerIds = benchPlayers.map((p) => p.id);

  if (!startingPlayerIds.includes(captainId) || !startingPlayerIds.includes(viceCaptainId)) {
    return {
      isValid: false,
      errorMessage: 'Captain và Vice-Captain bắt buộc phải nằm trong đội hình xuất phát 11 người.',
      payload: null,
    };
  }

  return {
    isValid: true,
    errorMessage: null,
    payload: {
      lineup_name: (customName && customName.trim()) || `FPL Squad ${formation}`,
      starting_player_ids: startingPlayerIds,
      bench_player_ids: benchPlayerIds,
      formation: formation,
      captain_id: captainId,
      vice_captain_id: viceCaptainId,
    },
  };
}

export interface UseShareLineupReturn {
  isSharing: boolean;
  shareCode: string | null;
  shareUrl: string | null;
  error: string | null;
  shareLineup: (customName?: string) => Promise<string | null>;
  resetShareState: () => void;
}

/**
 * Custom hook to generate and share a public snapshot of current lineup.
 * Communicates with POST /api/v1/lineups/share via apiClient.
 */
export const useShareLineup = (): UseShareLineupReturn => {
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareLineup = useCallback(
    async (customName?: string): Promise<string | null> => {
      setIsSharing(true);
      setError(null);

      const { startingXI, bench, captainId, viceCaptainId, formation } = useLineupStore.getState();

      const validation = validateLineupForShare(
        startingXI,
        bench,
        captainId,
        viceCaptainId,
        formation,
        customName
      );

      if (!validation.isValid || !validation.payload) {
        const msg = validation.errorMessage || 'Đội hình chưa hợp lệ để chia sẻ.';
        setError(msg);
        setIsSharing(false);
        return null;
      }

      try {
        const response = await apiClient.post<ShareLineupResponse>('/lineups/share', validation.payload);
        const code = response.share_code;

        setShareCode(code);
        return code;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo link chia sẻ.';
        setError(message);
        return null;
      } finally {
        setIsSharing(false);
      }
    },
    []
  );

  const resetShareState = useCallback(() => {
    setShareCode(null);
    setError(null);
    setIsSharing(false);
  }, []);

  const shareUrl = shareCode
    ? typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}#/share/${shareCode}`
      : `https://fantasy.premierleague.com/#/share/${shareCode}`
    : null;

  return {
    isSharing,
    shareCode,
    shareUrl,
    error,
    shareLineup,
    resetShareState,
  };
};

export default useShareLineup;
