import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnDef,
  flexRender,
  VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Target,
  X,
} from 'lucide-react';
import { Player, PositionType } from '../../types';
import { PlayerFilters, FilterState } from './PlayerFilters';
import { getPlayerKitUrl } from '../pitch/PlayerPitchSlot';

export interface PlayerTableProps {
  players: Player[];
  onSelectPlayer?: (player: Player) => void;
  selectedPlayerIds?: number[];
  targetSlot?: {
    position: PositionType;
    slotIndex?: number;
    isBench?: boolean;
  } | null;
  onCancelTargetSlot?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
  teams?: { id: number; short_name: string; name: string }[];
  isLoading?: boolean;
}

const POSITION_BADGE_COLORS: Record<PositionType, string> = {
  GKP: 'bg-white/10 text-brand-white border-white/30',
  DEF: 'bg-brand-skyblue/20 text-brand-skyblue-light border-brand-skyblue/40',
  MID: 'bg-brand-skyblue-dark text-brand-white border-brand-skyblue/40',
  FWD: 'bg-brand-hotpink/20 text-brand-hotpink-light border-brand-hotpink/40',
};

export const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  onSelectPlayer,
  selectedPlayerIds = [],
  targetSlot = null,
  onCancelTargetSlot,
  className = '',
  variant = 'default',
  teams,
  isLoading = false,
}) => {
  const isCompact = variant === 'compact';

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total_points', desc: true },
  ]);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    position: targetSlot ? targetSlot.position : 'ALL',
    teamId: 'ALL',
    maxPrice: 16.0,
  });

  // Automatically sync position filter when targetSlot is selected from pitch
  useEffect(() => {
    if (targetSlot) {
      setFilters((prev) => ({ ...prev, position: targetSlot.position }));
    }
  }, [targetSlot]);

  // Filter logic
  const filteredData = useMemo(() => {
    return players.filter((player) => {
      // Search by web_name or full name
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const fullName = `${player.first_name ?? ''} ${player.second_name ?? ''} ${player.web_name}`.toLowerCase();
        if (!fullName.includes(query)) return false;
      }

      // Filter by Position
      if (filters.position !== 'ALL' && player.element_type !== filters.position) {
        return false;
      }

      // Filter by Team
      if (filters.teamId !== 'ALL' && player.team_id !== filters.teamId) {
        return false;
      }

      // Filter by maxPrice
      if (player.now_cost > filters.maxPrice) {
        return false;
      }

      return true;
    });
  }, [players, filters]);

  const selectedSet = useMemo(() => new Set(selectedPlayerIds), [selectedPlayerIds]);

  // Column definitions
  const columns = useMemo<ColumnDef<Player>[]>(
    () => [
      {
        accessorKey: 'web_name',
        header: 'Cầu thủ',
        cell: ({ row }) => {
          const player = row.original;
          const isInjured = player.status === 'i';
          const isDoubtful = player.status === 'd';
          const isSuspended = player.status === 's';

          return (
            <div className="flex items-center gap-2.5">
              <img
                src={getPlayerKitUrl(
                  player.team_id,
                  player.element_type,
                  player.team_code,
                  player.team_short_name
                )}
                alt={player.team_short_name || player.web_name}
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow shrink-0"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-brand-white text-xs sm:text-sm hover:text-brand-skyblue-light transition-colors truncate">
                    {player.web_name}
                  </span>
                  {isInjured && (
                    <span className="px-1.5 py-0.5 bg-brand-hotpink/20 text-brand-hotpink-light border border-brand-hotpink/40 text-[10px] rounded font-bold" title="Chấn thương">
                      Injured
                    </span>
                  )}
                  {isDoubtful && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-brand-white border border-white/20 text-[10px] rounded font-bold" title="Khả năng ra sân 75%">
                      Doubt
                    </span>
                  )}
                  {isSuspended && (
                    <span className="px-1.5 py-0.5 bg-brand-hotpink-dark text-brand-white border border-brand-hotpink text-[10px] rounded font-bold" title="Treo giò">
                      Susp
                    </span>
                  )}
                </div>
                {/* Ở chế độ compact hiển thị dòng phụ 'CLB · VỊ TRÍ' giống web gốc FPL */}
                <span className="text-[11px] text-brand-muted font-medium">
                  {isCompact 
                    ? `${player.team_short_name ?? `Team ${player.team_id}`} · ${player.element_type}`
                    : (player.team_short_name ?? `Team ${player.team_id}`)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'element_type',
        header: 'Vị trí',
        cell: ({ row }) => {
          const pos = row.original.element_type;
          return (
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded border ${
                POSITION_BADGE_COLORS[pos] ?? 'bg-brand-card text-brand-white border-brand-border'
              }`}
            >
              {pos}
            </span>
          );
        },
      },
      {
        accessorKey: 'now_cost',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-brand-skyblue-light transition-colors"
          >
            Giá
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-brand-white text-xs sm:text-sm">
            £{row.original.now_cost.toFixed(1)}m
          </span>
        ),
      },
      {
        accessorKey: 'total_points',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-brand-skyblue-light transition-colors"
          >
            Tổng điểm
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-black text-brand-skyblue-light text-xs sm:text-sm">
            {row.original.total_points}
          </span>
        ),
      },
      {
        accessorKey: 'form',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-brand-skyblue-light transition-colors"
          >
            Phong độ
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const form = row.original.form;
          return (
            <span className="text-brand-white text-xs sm:text-sm">
              {form !== undefined && form !== null && !isNaN(Number(form))
                ? Number(form).toFixed(1)
                : '-'}
            </span>
          );
        },
      },
      {
        accessorKey: 'expected_points_next',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-brand-skyblue-light transition-colors"
          >
            xP vòng tới
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-brand-skyblue-light" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const xp = row.original.expected_points_next;
          return (
            <span className="text-brand-white font-semibold text-xs sm:text-sm">
              {xp !== undefined && xp !== null && !isNaN(Number(xp))
                ? Number(xp).toFixed(1)
                : '-'}
            </span>
          );
        },
      },
      {
        id: 'action',
        header: 'Chọn',
        cell: ({ row }) => {
          const player = row.original;
          const isSelected = selectedSet.has(player.id);

          return (
            <button
              onClick={() => onSelectPlayer && onSelectPlayer(player)}
              disabled={isSelected}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isSelected
                  ? 'bg-brand-card text-brand-muted cursor-not-allowed'
                  : 'bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white shadow-md shadow-brand-hotpink/20 active:scale-95'
              }`}
              title={isSelected ? 'Đã có trong đội hình' : 'Thêm cầu thủ vào đội hình'}
            >
              {isSelected ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span className={isCompact ? 'hidden' : 'inline'}>Đã chọn</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Chọn</span>
                </>
              )}
            </button>
          );
        },
      },
    ],
    [onSelectPlayer, selectedSet, isCompact]
  );

  // Column visibility for compact mode
  const columnVisibility = useMemo<VisibilityState>(() => {
    if (isCompact) {
      return {
        element_type: false,
        form: false,
        expected_points_next: false,
      };
    }
    return {};
  }, [isCompact]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Tự động nhảy về trang 1 khi filters thay đổi để tránh trường hợp trang hiện tại vượt quá tổng số trang mới
  useEffect(() => {
    table.setPageIndex(0);
  }, [filters]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Target Slot Banner */}
      {targetSlot && (
        <div className="bg-gradient-to-r from-brand-card via-brand-darker to-brand-darker border border-brand-skyblue/50 rounded-xl p-3 flex items-center justify-between shadow-lg shadow-brand-skyblue/10 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-skyblue/20 border border-brand-skyblue/40 flex items-center justify-center text-brand-skyblue-light shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-brand-skyblue-light flex items-center gap-1.5 flex-wrap">
                <span>Vị trí nhắm:</span>
                <span className="px-1.5 py-0.5 rounded bg-brand-skyblue text-brand-darker font-black text-xs uppercase">
                  {targetSlot.position}
                </span>
                <span className="text-brand-muted text-xs font-normal">
                  ({targetSlot.isBench ? 'Dự bị' : 'Chính thức'})
                </span>
              </p>
              {!isCompact && (
                <p className="text-[11px] text-brand-muted mt-0.5">
                  Bảng đã lọc cầu thủ <strong>{targetSlot.position}</strong>. Bấm <strong>+ Chọn</strong> để đưa vào slot!
                </p>
              )}
            </div>
          </div>
          {onCancelTargetSlot && (
            <button
              onClick={onCancelTargetSlot}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-card hover:bg-brand-card-hover text-xs text-brand-muted hover:text-brand-white border border-brand-border transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span className={isCompact ? 'hidden' : 'inline'}>Hủy nhắm vị trí</span>
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <PlayerFilters filters={filters} onFilterChange={setFilters} teams={teams} compact={isCompact} />

      {/* Table Container */}
      <div className="bg-brand-card/90 border border-brand-border rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-brand-border bg-brand-darker/60">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`${isCompact ? 'px-2.5 py-2' : 'px-4 py-3'} text-xs font-bold uppercase tracking-wider text-brand-muted`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-brand-muted">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-6 h-6 border-2 border-brand-skyblue border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-brand-skyblue-light">Đang tải dữ liệu cầu thủ từ Premier League...</p>
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-brand-card-hover transition-colors group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`${isCompact ? 'px-2.5 py-2' : 'px-4 py-3'} text-sm`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-brand-muted">
                    <UserCheck className="w-7 h-7 mx-auto mb-1.5 text-brand-muted" />
                    <p className="text-xs font-medium">Không tìm thấy cầu thủ phù hợp</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-3 py-2.5 border-t border-brand-border bg-brand-darker/60 gap-2">
          <div className="text-xs text-brand-muted">
            <span className="font-semibold text-brand-white">{filteredData.length}</span> cầu thủ
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-brand-muted mr-1.5">
              <span className="font-semibold text-brand-white">{table.getState().pagination.pageIndex + 1}</span> /{' '}
              <span className="font-semibold text-brand-white">{Math.max(1, table.getPageCount())}</span>
            </span>

            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-border disabled:opacity-40 disabled:cursor-not-allowed text-brand-white transition-colors"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-border disabled:opacity-40 disabled:cursor-not-allowed text-brand-white transition-colors"
              aria-label="Trang kế tiếp"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
