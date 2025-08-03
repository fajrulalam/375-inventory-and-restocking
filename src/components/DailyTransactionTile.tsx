"use client";

import { DailyTileData } from "@/utils/analysisDataUtils";
import { formatCurrency } from "@/utils/formatters";

interface DailyTransactionTileProps {
  tile: DailyTileData;
  onClick: () => void;
}

export default function DailyTransactionTile({
  tile,
  onClick
}: DailyTransactionTileProps) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-blue-400 hover:-translate-y-1"
      onClick={onClick}
    >
      <div className="text-center space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {tile.dayOfWeek}
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {tile.displayDate}
          </div>
        </div>

        <div className="text-2xl font-bold text-slate-800">
          {formatCurrency(tile.total)}
        </div>

        {tile.items.length > 0 && (
          <div className="flex justify-center">
            <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {tile.items.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}