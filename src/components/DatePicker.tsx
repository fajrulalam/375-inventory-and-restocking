"use client";

import { useState } from "react";
import { DateRange } from "@/utils/analysisDataUtils";

interface DatePickerProps {
  selectedDays: number;
  onDaysChange: (days: number) => void;
  dateRange: DateRange | null;
  isLoading: boolean;
}

export default function DatePicker({
  selectedDays,
  onDaysChange,
  dateRange,
  isLoading
}: DatePickerProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customDays, setCustomDays] = useState<string>(selectedDays.toString());

  const presetOptions = [
    { label: "7d", value: 7 },
    { label: "14d", value: 14 },
    { label: "30d", value: 30 },
    { label: "60d", value: 60 },
    { label: "90d", value: 90 }
  ];

  const handlePresetClick = (days: number) => {
    setIsCustomMode(false);
    setCustomDays(days.toString());
    onDaysChange(days);
  };

  const handleCustomSubmit = () => {
    const days = parseInt(customDays);
    if (days && days > 0 && days <= 365) {
      onDaysChange(days);
      setIsCustomMode(false);
    }
  };

  const handleCustomKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Time Period</h3>
        {dateRange && (
          <div className="text-sm text-gray-500">
            {formatDate(dateRange.startDate)} — {formatDate(dateRange.endDate)}
            {isLoading && <span className="ml-2 text-blue-500">•</span>}
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {presetOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handlePresetClick(option.value)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              selectedDays === option.value && !isCustomMode
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {option.label}
          </button>
        ))}
        
        <button
          onClick={() => setIsCustomMode(true)}
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            isCustomMode
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Custom
        </button>
      </div>

      {isCustomMode && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex gap-3">
            <input
              type="number"
              min="1"
              max="365"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              onKeyPress={handleCustomKeyPress}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Days"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}