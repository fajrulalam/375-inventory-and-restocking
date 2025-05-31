"use client";

import { useRef } from "react";
import { formatCurrency } from "@/utils/formatters";
import { HistoricalDataItem } from "@/utils/historicalDataUtils";

// Shimmer effect styles for current period's bar
const ShimmerStyle = () => (
  <style>
    {`
      .current-bar-shimmer {
        position: relative;
        overflow: hidden;
      }
      .current-bar-shimmer::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          to bottom, /* Shimmer moving upwards */
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.1) 30%,
          rgba(255, 255, 255, 0.3) 50%,
          rgba(255, 255, 255, 0.1) 70%,
          rgba(255, 255, 255, 0) 100%
        );
        transform: translateY(100%); /* Start below the bar */
        animation: shimmer-effect 2.5s infinite linear;
      }

      @keyframes shimmer-effect {
        0% {
          transform: translateY(100%);
        }
        100% {
          transform: translateY(-100%);
        }
      }
    `}
  </style>
);

interface CustomBarChartProps {
  data: HistoricalDataItem[];
  onHover: (item: HistoricalDataItem | null, index: number) => void;
  hoveredBar: number | null;
  currentExists?: boolean;
  timePeriod: "daily" | "monthly" | "yearly";
  maxYAxis: number;
  yAxisTicks: number[];
  medianValue: number;
}

const CustomBarChart = ({
  data,
  onHover,
  hoveredBar,
  currentExists,
  timePeriod,
  maxYAxis,
  yAxisTicks,
  medianValue,
}: CustomBarChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full w-full flex flex-col">
      <ShimmerStyle />
      {/* Y-axis */}
      <div className="flex flex-1">
        {/* Y-axis labels */}
        <div className="w-24 pr-2 flex flex-col justify-between text-xs text-gray-500">
          {yAxisTicks
            .slice()
            .reverse()
            .map((tick, index) => (
              <div key={index} className="py-1">
                {formatCurrency(tick)}
              </div>
            ))}
        </div>

        {/* Chart area */}
        <div ref={chartRef} className="flex-1 flex">
          <div className="w-full h-full flex justify-between relative border-l border-gray-300">
            {/* Horizontal grid lines (appear behind the bars) */}
            <div className="absolute inset-0 w-full h-full flex flex-col justify-between pointer-events-none z-0">
              {yAxisTicks.map((tick, index) => (
                <div
                  key={index}
                  className={`w-full ${
                    tick === 0
                      ? "border-b border-gray-300"
                      : "border-t border-gray-200"
                  }`}
                  style={{
                    position: "absolute",
                    bottom: `${(tick / maxYAxis) * 100}%`,
                    left: 0,
                  }}
                ></div>
              ))}
            </div>

            {/* Median line */}
            <div
              className="absolute w-full z-20 flex items-center"
              style={{
                bottom: `${(medianValue / maxYAxis) * 100}%`,
                height: "2px",
              }}
            >
              <div className="bg-gray-100 text-xs text-gray-800 font-medium px-1 py-0 rounded mr-1 border border-black opacity-80 whitespace-nowrap">
                Median: {formatCurrency(medianValue)}
              </div>
              <div className="w-full h-[1.5px] bg-black opacity-70"></div>
            </div>

            {/* Bars */}
            <div className="absolute inset-0 w-full h-full flex z-10">
              {data.map((item, index) => {
                // Calculate height based on percentage of max y-axis value
                // If maxYAxis is 0 (no data), set a minimum height
                const heightPercentage =
                  maxYAxis > 0 ? (item.total / maxYAxis) * 100 : 0;

                // Check if this bar represents current period (using either isToday for backward compatibility or isCurrent)
                const isCurrentPeriod = item.isCurrent || item.isToday;

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-end"
                    style={{ width: `${100 / data.length}%` }}
                    onMouseEnter={() => onHover(item, index)}
                    onMouseLeave={() => onHover(null, -1)}
                  >
                    <div
                      className={`w-[80%] transition-all duration-300 ${
                        hoveredBar === index
                          ? "opacity-80 scale-105"
                          : "opacity-100"
                      } ${isCurrentPeriod ? "current-bar-shimmer" : ""}`}
                      style={{
                        height: `${heightPercentage}%`,
                        background: isCurrentPeriod
                          ? "linear-gradient(to top, #E52620, #FF7300)"
                          : "#4F46E5",
                        borderRadius: "4px 4px 0 0",
                      }}
                    ></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex mt-2 pl-16">
        {data.map((item, index) => (
          <div
            key={index}
            className={`text-xs text-center ${
              hoveredBar === index ? "font-bold text-gray-900" : "text-gray-600"
            }`}
            style={{ width: `${100 / data.length}%` }}
          >
            {item.date}
          </div>
        ))}
      </div>

      {/* Legend */}
      {/* <div className="flex justify-end mt-4 text-sm"> */}
      <div className="flex items-center mr-4">
        <div className="w-3 h-3 bg-[#4F46E5] rounded-sm mr-1"></div>
        <span>Historical {getPeriodLabel(timePeriod)}</span>
      </div>
      {data.some((item) => item.isCurrent || item.isToday) && (
        <div className="flex items-center">
          <div className="w-3 h-3 bg-[#F97316] rounded-sm mr-1"></div>
          <span>
            Current {getPeriodLabel(timePeriod, true)}{" "}
            {!currentExists ? "(Projected)" : ""}
          </span>
        </div>
      )}
      {/* </div> */}
    </div>
  );
};

// Helper function to get appropriate label based on time period
const getPeriodLabel = (
  period: "daily" | "monthly" | "yearly",
  isSingular: boolean = false
): string => {
  switch (period) {
    case "monthly":
      return isSingular ? "Month" : "Months";
    case "yearly":
      return isSingular ? "Year" : "Years";
    case "daily":
    default:
      return isSingular ? "Day" : "Days";
  }
};

export default CustomBarChart;
