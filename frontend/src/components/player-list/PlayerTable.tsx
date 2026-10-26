import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnDef,
  flexRender,
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
import { Player, PositionType } from '@/types';
import { PlayerFilters, FilterState } from './PlayerFilters';

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
}

const POSITION_BADGE_COLORS: Record<PositionType, string> = {
  GKP: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  MID: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  FWD: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

export const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  onSelectPlayer,
  selectedPlayerIds = [],
  targetSlot = null,
  onCancelTargetSlot,
  className = '',
}) => {
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
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-100 text-sm hover:text-emerald-400 transition-colors">
                    {player.web_name}
                  </span>
                  {isInjured && (
                    <span className="px-1 py-0.2 bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] rounded font-bold" title="Chấn thương">
                      Injured
                    </span>
                  )}
                  {isDoubtful && (
                    <span className="px-1 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] rounded font-bold" title="Khả năng ra sân 75%">
                      Doubt
                    </span>
                  )}
                  {isSuspended && (
                    <span className="px-1 py-0.2 bg-red-600/30 text-red-400 border border-red-500/40 text-[10px] rounded font-bold" title="Treo giò">
                      Susp
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {player.team_short_name ?? `Team ${player.team_id}`}
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
                POSITION_BADGE_COLORS[pos] ?? 'bg-slate-700 text-slate-300'
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
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Giá
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-slate-200 text-sm">
            £{row.original.now_cost.toFixed(1)}m
          </span>
        ),
      },
      {
        accessorKey: 'total_points',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Tổng điểm
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-black text-emerald-400 text-sm">
            {row.original.total_points}
          </span>
        ),
      },
      {
        accessorKey: 'form',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Phong độ
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-slate-300 text-sm">
            {row.original.form !== undefined ? row.original.form.toFixed(1) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'expected_points_next',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            xP vòng tới
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-amber-400 font-semibold text-sm">
            {row.original.expected_points_next !== undefined
              ? row.original.expected_points_next.toFixed(1)
              : '-'}
          </span>
        ),
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isSelected
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95'
              }`}
              title={isSelected ? 'Đã có trong đội hình' : 'Thêm cầu thủ vào đội hình'}
            >
              {isSelected ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã chọn</span>
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
    [onSelectPlayer, selectedSet]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Target Slot Banner */}
      {targetSlot && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/50 rounded-xl p-3.5 flex items-center justify-between shadow-lg shadow-emerald-500/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <span>Đang chọn cầu thủ cho vị trí:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-xs uppercase">
                  {targetSlot.position}
                </span>
                <span className="text-slate-400 text-xs font-normal">
                  ({targetSlot.isBench ? 'Ghế dự bị' : 'Đội hình chính thức'})
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Bảng đã tự động lọc các cầu thủ vị trí <strong>{targetSlot.position}</strong>. Bấm nút <strong>+ Chọn</strong> để đưa ngay vào vị trí này!
              </p>
            </div>
          </div>
          {onCancelTargetSlot && (
            <button
              onClick={onCancelTargetSlot}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy nhắm vị trí</span>
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <PlayerFilters filters={filters} onFilterChange={setFilters} />

      {/* Table Container */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-800 bg-slate-950/60">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-medium">Không tìm thấy cầu thủ nào phù hợp với bộ lọc</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Status Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/60 gap-3">
          <div className="text-xs text-slate-400">
            Hiển thị <span className="font-semibold text-slate-200">{filteredData.length}</span> cầu thủ
            {players.length !== filteredData.length && (
              <span> (lọc từ tổng số {players.length})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-2">
              Trang <span className="font-semibold text-slate-200">{table.getState().pagination.pageIndex + 1}</span> /{' '}
              <span className="font-semibold text-slate-200">{Math.max(1, table.getPageCount())}</span>
            </span>

            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
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

