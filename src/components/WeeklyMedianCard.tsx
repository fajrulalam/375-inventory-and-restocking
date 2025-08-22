"use client";

import { formatCurrency } from "@/utils/formatters";

interface WeeklyMedianCardProps {
  dayName: string;
  median: number;
  isLoading: boolean;
  onClick?: () => void;
  isFiltered?: boolean;
}

export default function WeeklyMedianCard({
  dayName,
  median,
  isLoading,
  onClick,
  isFiltered = false
}: WeeklyMedianCardProps) {
  const abbreviatedDay = dayName.slice(0, 3);

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:border-blue-400 hover:-translate-y-1' : ''
      }`}
      onClick={onClick}
    >
      <div className="text-center space-y-3">
        <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {abbreviatedDay}
        </div>

        {isLoading ? (
          <div className="h-8 bg-gray-200 animate-pulse rounded-lg"></div>
        ) : (
          <div className="text-xl font-bold text-slate-800">
            {median > 0 ? (isFiltered ? median.toString() : formatCurrency(median)) : '—'}
          </div>
        )}
      </div>
    </div>
  );
}