"use client";

import { useEffect } from "react";
import useMediaQuery from "@/utils/useMediaQuery";
import BoxPlotChart from "./BoxPlotChart";
import { WeeklyMedianData } from "@/utils/analysisDataUtils";

interface BoxPlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyData: WeeklyMedianData[];
  selectedDays: number;
}

export default function BoxPlotModal({
  isOpen,
  onClose,
  weeklyData,
  selectedDays
}: BoxPlotModalProps) {
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

  // Transform weekly data for box plot
  const boxPlotData = weeklyData.map(day => ({
    dayName: day.dayName,
    values: day.calculationData.map(d => d.total),
    median: day.median,
    q1: 0, // Will be calculated in the chart
    q3: 0, // Will be calculated in the chart
    min: 0, // Will be calculated in the chart
    max: 0, // Will be calculated in the chart
    outliers: [] // Will be calculated in the chart
  }));

  // Calculate some summary statistics
  const totalDataPoints = weeklyData.reduce((sum, day) => sum + day.calculationData.length, 0);
  const daysWithData = weeklyData.filter(day => day.calculationData.length > 0).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-black/30 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`
          ${
            isDesktop
              ? "bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh]"
              : "bg-white rounded-xl max-h-[90vh] w-full max-w-lg"
          }
          p-6 relative overflow-y-auto transition-all duration-300 ease-in-out transform-gpu
          ${
            isOpen
              ? "scale-100 opacity-100"
              : "scale-95 opacity-0"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">
              Weekly Transaction Distribution
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Box plot analysis for the last {selectedDays} days
            </p>
            <div className="flex gap-4 text-xs text-gray-500 mt-2">
              <span>Total data points: {totalDataPoints}</span>
              <span>Days with data: {daysWithData}/7</span>
            </div>
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

        {/* Box Plot Chart */}
        <div className="mb-6">
          <BoxPlotChart 
            data={boxPlotData} 
            width={isDesktop ? 700 : 400}
            height={isDesktop ? 450 : 350}
          />
        </div>

        {/* Weekly Summary */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-7 gap-4">
          {weeklyData.filter(day => day.calculationData.length > 0).map(day => (
            <div key={day.dayName} className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="font-bold text-gray-800 text-lg">{day.dayName.slice(0, 3)}</div>
              <div className="text-blue-600 font-bold text-xl mt-2">
                {day.median.toLocaleString('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </div>
              <div className="text-xs text-gray-500 mt-1">{day.calculationData.length} days</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}