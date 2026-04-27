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
      return Math.max(max, item.revenue + (item.pendingRevenue || 0));
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
    effectiveYAxisInterval,
  );

  const handleBarHover = (item: HourlyDataItem | null, index: number) => {
    setHoveredBar(item ? index : null);
  };

  // Calculate totals for display in header
  const getTotals = () => {
    if (data.length === 0) return { total: 0, pending: 0 };

    const servedTotal = data.reduce((sum, item) => sum + item.total, 0);
    const pendingTotal = data.reduce((sum, item) => sum + item.pendingTotal, 0);

    return {
      served: servedTotal,
      pending: pendingTotal,
      total: servedTotal + pendingTotal,
    };
  };

  // We're not using these values currently as the display is commented out
  // but we keep the function for future use
  getTotals();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-white z-20 flex justify-center items-center p-6">
          <div className="animate-pulse flex flex-col w-full gap-4">
            <div className="h-5 bg-gray-100 rounded-lg w-1/2"></div>
            <div className="h-[200px] bg-gray-100 rounded-lg w-full"></div>
            <div className="flex justify-center gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-3 bg-gray-100 rounded w-10"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-sm font-medium text-gray-500">
          Hourly {dataTypeLabels[dataType]}
        </h2>
        <div className="flex p-0.5 bg-gray-100 rounded-lg mt-2 sm:mt-0">
          {(Object.keys(dataTypeLabels) as HistogramDataType[]).map((type) => (
            <button
              key={type}
              onClick={() => setDataType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
                dataType === type
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {dataTypeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] mt-4 mb-4">
        <HourlyHistogram
          data={data}
          maxYAxis={maxYAxis}
          yAxisTicks={yAxisTicks}
          yAxisInterval={yAxisInterval}
          onHover={handleBarHover}
          hoveredBar={hoveredBar}
          dataType={dataType}
        />
      </div>
    </div>
  );
};

export default HourlyHistogramTile;
