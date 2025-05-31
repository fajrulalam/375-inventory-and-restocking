"use client";

import { useEffect, useState } from "react";
import useMediaQuery from "@/utils/useMediaQuery";
import { formatCurrency } from "@/utils/formatters";
import CustomBarChart from "./CustomBarChart";
import {
  HistoricalDataItem,
  TimePeriod,
  processHistoricalData,
  formatChartData,
  calculateChartStatistics,
} from "@/utils/historicalDataUtils";

interface HistoricalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HistoricalDataItem[];
  timePeriod?: TimePeriod;
  periodLabel: string;
  actualCurrentTotal?: number;
  yAxisInterval?: number;
}

export default function HistoricalDataModal({
  isOpen,
  onClose,
  data,
  timePeriod = "daily",
  periodLabel,
  actualCurrentTotal,
  yAxisInterval = 100000,
}: HistoricalDataModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)"); // md breakpoint
  // Default placeholder value for today if data doesn't exist
  const [placeholderValue, setPlaceholderValue] = useState(100000);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    item: HistoricalDataItem | null;
    index: number;
  }>({ item: null, index: -1 });

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

  // Process the historical data
  const { chartData, currentExists, hasActualCurrentData } =
    processHistoricalData(
      data,
      actualCurrentTotal,
      placeholderValue,
      timePeriod
    );

  // Format the data for display
  const formattedChartData = formatChartData(chartData, timePeriod);

  // Calculate chart statistics
  const { maxYAxis, yAxisTicks, medianValue } = calculateChartStatistics(
    chartData,
    yAxisInterval
  );

  const handleBarHover = (item: HistoricalDataItem | null, index: number) => {
    setHoveredBar(index >= 0 ? index : null);
    setTooltipInfo({ item, index });
  };

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
              ? "bg-white/80 backdrop-blur-md rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh]"
              : "bg-white/80 backdrop-blur-md rounded-t-2xl max-h-[90vh] w-full"
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
        {!isDesktop && (
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
        )}
        <div
          className={`flex ${
            isDesktop ? "justify-between" : "flex-col-reverse"
          } items-center mb-6`}
        >
          <h3
            className={`text-xl font-bold ${
              !isDesktop ? "mt-2 text-center w-full" : ""
            }`}
          >
            Historical Data: Last {data.length} {periodLabel}
          </h3>
          <div
            className={`flex items-center ${
              !isDesktop ? "w-full justify-end" : ""
            }`}
          >
            {!hasActualCurrentData && timePeriod === "daily" && (
              <div className="mr-4 flex items-center">
                <span className="text-sm text-gray-600 mr-2">
                  Placeholder Value:
                </span>
                {isAdjusting ? (
                  <input
                    type="number"
                    className="w-24 px-2 py-1 border rounded"
                    value={placeholderValue}
                    onChange={(e) =>
                      setPlaceholderValue(Number(e.target.value))
                    }
                    onBlur={() => setIsAdjusting(false)}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setIsAdjusting(true)}
                    className="text-blue-500 hover:text-blue-700 underline text-sm"
                  >
                    {formatCurrency(placeholderValue)}
                  </button>
                )}
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-gray-500 hover:text-gray-700 p-2"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {formattedChartData.length > 0 ? (
          <div className="h-[400px] w-full relative">
            {/* Custom Bar Chart */}
            <CustomBarChart
              data={formattedChartData}
              onHover={handleBarHover}
              hoveredBar={hoveredBar}
              currentExists={currentExists}
              timePeriod={timePeriod}
              maxYAxis={maxYAxis}
              yAxisTicks={yAxisTicks}
              medianValue={medianValue}
            />

            {/* Tooltip */}
            {tooltipInfo.item && (
              <div
                className="absolute bg-white p-3 border border-gray-200 shadow-md rounded-md z-10"
                style={{
                  top: "0px",
                  left: `${
                    (tooltipInfo.index / formattedChartData.length) * 100
                  }%`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="text-sm text-gray-600">{tooltipInfo.item.date}</p>
                <p className="text-sm font-bold">
                  {formatCurrency(tooltipInfo.item.total)}
                </p>
                {(tooltipInfo.item.isCurrent || tooltipInfo.item.isToday) &&
                  !hasActualCurrentData &&
                  timePeriod === "daily" && (
                    <p className="text-xs italic text-orange-500">
                      Projected value
                    </p>
                  )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">
            No historical data available
          </p>
        )}
      </div>
    </div>
  );
}
