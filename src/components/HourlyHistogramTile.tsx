"use client";

import { useState } from "react";
import HourlyHistogram from "./HourlyHistogram";
import {
  HourlyDataItem,
  calculateHistogramStatistics,
} from "@/utils/hourlyHistogramUtils";
// formatCurrency removed as it's not used in this component

export type HistogramDataType = "total" | "revenue" | "customerCount";

export const dataTypeLabels: Record<HistogramDataType, string> = {
  total: "Total Items",
  revenue: "Revenue",
  customerCount: "Customers",
};

interface HourlyHistogramTileProps {
  data: HourlyDataItem[];
  isLoading?: boolean;
  yAxisInterval?: number;
  initialDataType?: HistogramDataType;
}

const HourlyHistogramTile = ({
  data,
  isLoading = false,
  yAxisInterval = 15,
  initialDataType = "total",
}: HourlyHistogramTileProps) => {
  const [dataType, setDataType] = useState<HistogramDataType>(initialDataType);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Determine appropriate y-axis interval for revenue based on maximum value
  const getDynamicRevenueInterval = () => {
    if (data.length === 0) return 50000;

    // Calculate the maximum combined value for revenue
    const maxRevenue = data.reduce((max, item) => {
      // Use the actual value for pending revenue
      return Math.max(max, item.revenue + item.pendingTotal);
    }, 0);

    if (maxRevenue < 200000) return 50000;
    if (maxRevenue < 500000) return 100000;
    return 200000;
  };

  // Use dynamic interval for revenue, static for others
  const effectiveYAxisInterval =
    dataType === "revenue" ? getDynamicRevenueInterval() : yAxisInterval;

  // Get stats with proper Y-axis calculations for each dataType
  const { maxYAxis, yAxisTicks } = calculateHistogramStatistics(
    data,
    dataType,
    effectiveYAxisInterval
  );

  const handleBarHover = (item: HourlyDataItem | null, index: number) => {
    setHoveredBar(item ? index : null);
  };

  // Calculate totals for display in header
  const getTotals = () => {
    if (data.length === 0) return { total: 0, pending: 0 };

    const servedTotal = data.reduce((sum, item) => sum + item.total, 0);
    const pendingTotal = data.reduce((sum, item) => sum + item.pendingTotal, 0);

    return { served: servedTotal, pending: pendingTotal, total: servedTotal + pendingTotal };
  };

  // We're not using these values currently as the display is commented out
  // but we keep the function for future use
  getTotals();

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full relative overflow-hidden">
      {/* Skeleton loader */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 z-20 flex justify-center items-center">
          <div className="animate-pulse flex flex-col w-full gap-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-[200px] bg-gray-200 rounded w-full"></div>
            <div className="flex justify-center gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded w-10"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Hourly {dataTypeLabels[dataType]}
          </h2>
          {/* {!isLoading && (
            <div className="text-sm text-gray-600">
              {dataType === "total" ? (
                <>
                  <span className="font-medium text-indigo-700">{served}</span>{" "}
                  served +
                  <span className="font-medium text-gray-700 ml-1">
                    {pending}
                  </span>{" "}
                  pending =
                  <span className="font-medium text-black ml-1">{total}</span>{" "}
                  total
                </>
              ) : dataType === "revenue" ? (
                <>
                  <span className="font-medium text-indigo-700">
                    {formatCurrency(served)}
                  </span>{" "}
                  served +
                  <span className="font-medium text-gray-700 ml-1">
                    {formatCurrency(pending)}
                  </span>{" "}
                  in progress
                </>
              ) : (
                <>
                  <span className="font-medium text-indigo-700">{served}</span>{" "}
                  served customers +
                  <span className="font-medium text-gray-700 ml-1">
                    {pending > 0 ? pending : 0}
                  </span>{" "}
                  waiting
                </>
              )}
            </div>
          )} */}
        </div>
        <div className="flex space-x-1 p-1 bg-gray-200 rounded-lg mt-2 sm:mt-0">
          {(Object.keys(dataTypeLabels) as HistogramDataType[]).map((type) => (
            <button
              key={type}
              onClick={() => setDataType(type)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors
                ${
                  dataType === type
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-300"
                }`}
            >
              {dataTypeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Content */}
      <div className="h-[300px] mt-6 mb-4">
        <HourlyHistogram
          data={data}
          maxYAxis={maxYAxis}
          yAxisTicks={yAxisTicks}
          yAxisInterval={yAxisInterval}
          onHover={handleBarHover}
          hoveredBar={hoveredBar}
          dataType={dataType} // Pass the current dataType
        />
      </div>
    </div>
  );
};

export default HourlyHistogramTile;
