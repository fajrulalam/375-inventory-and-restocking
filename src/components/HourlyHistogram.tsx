"use client";

import { useRef } from "react";
import { HourlyDataItem } from "@/utils/hourlyHistogramUtils";
import { HistogramDataType, dataTypeLabels } from "./HourlyHistogramTile"; // Import from Tile
import { formatCurrency } from "@/utils/formatters";

// Shimmer effect styles for current hour's bar
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
          to bottom,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.1) 30%,
          rgba(255, 255, 255, 0.3) 50%,
          rgba(255, 255, 255, 0.1) 70%,
          rgba(255, 255, 255, 0) 100%
        );
        transform: translateY(100%);
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

interface HourlyHistogramProps {
  data: HourlyDataItem[];
  maxYAxis: number;
  yAxisTicks: number[];
  yAxisInterval?: number;
  onHover?: (item: HourlyDataItem | null, index: number) => void;
  hoveredBar?: number | null;
  dataType: HistogramDataType; // Added dataType prop
}

const HourlyHistogram = ({
  data,
  maxYAxis,
  yAxisTicks,
  yAxisInterval = 15,
  onHover = () => {},
  hoveredBar = null,
  dataType,
}: HourlyHistogramProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate stacked bar values based on dataType
  const getStackedValues = (item: HourlyDataItem, dataType: HistogramDataType) => {
    if (dataType === 'total') {
      // For total items, use the actual values directly
      return {
        baseValue: item.total, 
        stackValue: item.pendingTotal,
        baseLabel: 'Served',
        stackLabel: 'Pending',
        totalValue: item.total + item.pendingTotal
      };
    } else if (dataType === 'revenue') {
      // For revenue, use the direct values
      return {
        baseValue: item.revenue,
        stackValue: item.pendingTotal,
        baseLabel: 'Served',
        stackLabel: 'In Progress',
        totalValue: item.revenue + item.pendingTotal
      };
    } else if (dataType === 'customerCount') {
      // For customer count, estimate pending customers (1 per pending item, max 1)
      const pendingCustomers = item.pendingTotal > 0 ? 1 : 0;
      return {
        baseValue: item.customerCount,
        stackValue: pendingCustomers,
        baseLabel: 'Served',
        stackLabel: 'Waiting',
        totalValue: item.customerCount + pendingCustomers
      };
    }
    
    // Default fallback
    return {
      baseValue: item[dataType],
      stackValue: 0,
      baseLabel: dataTypeLabels[dataType],
      stackLabel: 'Pending',
      totalValue: item[dataType]
    };
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      <ShimmerStyle />
      
      {/* Chart area */}
      <div className="flex flex-1">
        {/* Y-axis labels */}
        <div className="w-12 pr-2 flex flex-col justify-between text-xs text-gray-500">
          {yAxisTicks
            .slice()
            .reverse()
            .map((tick, index) => (
              <div key={index} className="py-1">
                {tick}
              </div>
            ))}
        </div>

        {/* Chart content */}
        <div ref={chartRef} className="flex-1 flex">
          <div className="w-full h-full flex justify-between relative border-l border-gray-300">
            {/* Horizontal grid lines */}
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

            {/* Bars */}
            <div className="absolute inset-0 w-full h-full flex z-10">
              {data.map((item, index) => {
                const isCurrentHour = item.isCurrent;
                const { 
                  baseValue, 
                  stackValue, 
                  baseLabel, 
                  stackLabel, 
                  totalValue 
                } = getStackedValues(item, dataType);
                
                // Calculate heights as percentages
                const baseHeightPercentage = maxYAxis > 0 ? (baseValue / maxYAxis) * 100 : 0;
                const stackHeightPercentage = maxYAxis > 0 ? (stackValue / maxYAxis) * 100 : 0;
                const totalHeightPercentage = baseHeightPercentage + stackHeightPercentage;
                
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-end"
                    style={{ width: `${100 / data.length}%` }}
                    onMouseEnter={() => onHover(item, index)}
                    onMouseLeave={() => onHover(null, -1)}
                  >
                    {/* We use absolute positioning for perfect stacking */}
                    <div className="relative w-[80%]" style={{ height: `${totalHeightPercentage}%` }}>
                      {/* Stacked bars container with fixed height */}
                      <div 
                        className="absolute bottom-0 w-full"
                        style={{ height: "100%" }}
                      >
                        {/* Base layer - RecentlyServed (always at bottom) */}
                        {baseHeightPercentage > 0 && (
                          <div
                            className={`absolute bottom-0 w-full transition-all duration-300 ${
                              hoveredBar === index ? "opacity-80" : "opacity-100"
                            } ${isCurrentHour ? "current-bar-shimmer" : ""}`}
                            style={{
                              height: `${(baseHeightPercentage / totalHeightPercentage) * 100}%`,
                              minHeight: "2px",
                              background: isCurrentHour ? "#FF9800" : "#4F46E5", // Orange or Blue
                              borderRadius: stackHeightPercentage > 0 ? "0 0 4px 4px" : "4px"
                            }}
                          ></div>
                        )}
                        
                        {/* Top layer - Status (always on top) */}
                        {stackHeightPercentage > 0 && (
                          <div
                            className="absolute w-full transition-all duration-300"
                            style={{
                              bottom: `${(baseHeightPercentage / totalHeightPercentage) * 100}%`,
                              height: `${(stackHeightPercentage / totalHeightPercentage) * 100}%`,
                              minHeight: "2px",
                              background: "#9CA3AF", // Grey color for pending
                              borderRadius: "4px 4px 0 0",
                              // Add a subtle connecting effect
                              borderBottom: baseHeightPercentage > 0 ? "1px solid rgba(255,255,255,0.3)" : "none"
                            }}
                          ></div>
                        )}
                      </div>
                    </div>

                    {/* Tooltip on hover */}
                    {hoveredBar === index && (
                      <div className="absolute bottom-full mb-2 bg-white shadow-lg rounded-md p-2 text-xs z-30 transform -translate-x-1/2 left-1/2 whitespace-nowrap">
                        <div className="font-bold text-gray-900 border-b pb-1 mb-1">{item.hour}</div>
                        {dataType === 'revenue' ? (
                          <>
                            <div className="flex justify-between gap-2">
                              <span className="text-indigo-700">{baseLabel}:</span> 
                              <span>{formatCurrency(baseValue)}</span>
                            </div>
                            {stackValue > 0 && (
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-700">{stackLabel}:</span>
                                <span>{formatCurrency(stackValue)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-2 font-medium pt-1 border-t mt-1">
                              <span>Total:</span>
                              <span>{formatCurrency(totalValue)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div><span className="text-indigo-700">{baseLabel}:</span> {baseValue}</div>
                            {stackValue > 0 && <div><span className="text-gray-700">{stackLabel}:</span> {stackValue}</div>}
                            <div className="font-medium pt-1 border-t mt-1">Total: {totalValue}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex mt-2 pl-12">
        {data.map((item, index) => (
          <div
            key={index}
            className={`text-xs text-center ${
              hoveredBar === index ? "font-bold text-gray-900" : "text-gray-600"
            }`}
            style={{ width: `${100 / data.length}%` }}
          >
            {item.hour}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-end mt-4 text-sm">
        <div className="flex items-center mr-4">
          <div className="w-3 h-3 bg-[#4F46E5] rounded-sm mr-1"></div>
          <span>Served</span>
        </div>
        <div className="flex items-center mr-4">
          <div className="w-3 h-3 bg-[#9CA3AF] rounded-sm mr-1"></div>
          <span>Pending</span>
        </div>
        {isCurrentHour(data) && (
          <div className="flex items-center">
            <div className="w-3 h-3 bg-[#FF9800] rounded-sm mr-1"></div>
            <span>Current hour</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to check if any bar represents the current hour
const isCurrentHour = (data: HourlyDataItem[]): boolean => {
  return data.some(item => item.isCurrent);
};

export default HourlyHistogram;