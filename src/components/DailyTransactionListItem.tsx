"use client";

import { DailyTileData } from "@/utils/analysisDataUtils";
import { formatCurrency } from "@/utils/formatters";

interface DailyTransactionListItemProps {
  tile: DailyTileData;
  onClick: () => void;
}

export default function DailyTransactionListItem({
  tile,
  onClick
}: DailyTransactionListItemProps) {
  // Format date as "EEE, dd MMM"
  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div
      className="bg-white border border-gray-200 hover:border-blue-300 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-700">
              {formatDateShort(tile.date)}
            </div>
            {tile.items.length > 0 && (
              <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                 {tile.customerNumber} customers
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
            {formatCurrency(tile.total)}
          </div>
        </div>
        
        {/* Arrow indicator */}
        <div className="ml-4 text-gray-400 group-hover:text-blue-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}