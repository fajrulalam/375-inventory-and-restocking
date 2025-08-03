"use client";

import { useEffect } from "react";
import useMediaQuery from "@/utils/useMediaQuery";
import { formatCurrency } from "@/utils/formatters";

interface MedianCalculationData {
  date: string;
  displayDate: string;
  total: number;
}

interface WeeklyMedianModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayName: string;
  median: number;
  calculationData: MedianCalculationData[];
}

export default function WeeklyMedianModal({
  isOpen,
  onClose,
  dayName,
  median,
  calculationData
}: WeeklyMedianModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Sort calculation data by date (newest first)
  const sortedData = [...calculationData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm bg-black/30 p-0 md:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`
          ${
            isDesktop
              ? "bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh]"
              : "bg-white rounded-t-2xl max-h-[90vh] w-full"
          }
          p-6 relative overflow-y-auto transition-all duration-300 ease-in-out transform-gpu
          ${
            isOpen
              ? isDesktop
                ? "scale-100 opacity-100"
                : "translate-y-0 opacity-100"
              : isDesktop
              ? "scale-95 opacity-0"
              : "translate-y-full opacity-0"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag indicator */}
        {!isDesktop && (
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {dayName} Median Calculation
            </h3>
            <p className="text-lg text-blue-600 font-semibold mt-1">
              Median: {median > 0 ? formatCurrency(median) : 'No data'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Based on {calculationData.length} {dayName}{calculationData.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div>
          {calculationData.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No {dayName} data found in the selected timeframe
            </p>
          ) : (
            <div className="space-y-3">
              <h4 className="text-md font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                Dates Used in Calculation
              </h4>
              {sortedData.map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="text-gray-800 font-medium">
                      {item.displayDate}
                    </span>
                    <div className="text-xs text-gray-500">
                      {item.date}
                    </div>
                  </div>
                  <span className="text-green-600 font-semibold">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
              
              {calculationData.length > 1 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>How median is calculated:</strong> The values are sorted, and the middle value is taken. 
                    {calculationData.length % 2 === 0 ? 
                      ` Since there are ${calculationData.length} values (even), the median is the average of the two middle values.` :
                      ` Since there are ${calculationData.length} values (odd), the median is the middle value.`
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}