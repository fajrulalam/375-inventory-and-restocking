"use client";

import { formatCurrency } from "@/utils/formatters";

interface BoxPlotData {
  dayName: string;
  values: number[];
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  outliers: number[];
}

interface BoxPlotChartProps {
  data: BoxPlotData[];
  width?: number;
  height?: number;
}

// Calculate box plot statistics
const calculateBoxPlotStats = (values: number[]): Omit<BoxPlotData, 'dayName' | 'values'> => {
  if (values.length === 0) {
    return { median: 0, q1: 0, q3: 0, min: 0, max: 0, outliers: [] };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Calculate quartiles
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];

  const q1Index = Math.floor(n / 4);
  const q3Index = Math.floor(3 * n / 4);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  // Calculate IQR and outlier bounds
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Find min/max (excluding outliers)
  const nonOutliers = sorted.filter(v => v >= lowerBound && v <= upperBound);
  const min = nonOutliers.length > 0 ? Math.min(...nonOutliers) : sorted[0];
  const max = nonOutliers.length > 0 ? Math.max(...nonOutliers) : sorted[sorted.length - 1];

  // Find outliers
  const outliers = sorted.filter(v => v < lowerBound || v > upperBound);

  return { median, q1, q3, min, max, outliers };
};

export default function BoxPlotChart({ data, width = 600, height = 400 }: BoxPlotChartProps) {
  const margin = { top: 40, right: 40, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Get all values to determine the y-scale
  const allValues = data.flatMap(d => [...d.values, ...d.outliers]);
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  const valueRange = maxValue - minValue;
  const yPadding = valueRange * 0.1;
  const yMin = minValue - yPadding;
  const yMax = maxValue + yPadding;

  // Scale functions
  const xScale = (index: number) => (index + 0.5) * (chartWidth / data.length);
  const yScale = (value: number) => chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

  // Box width
  const boxWidth = Math.min(60, chartWidth / data.length * 0.6);

  // Generate y-axis ticks
  const numTicks = 6;
  const yTicks = Array.from({ length: numTicks }, (_, i) => 
    yMin + (yMax - yMin) * (i / (numTicks - 1))
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="bg-white">
        {/* Background */}
        <rect width={width} height={height} fill="white" />
        
        {/* Chart area */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={0}
                y1={yScale(tick)}
                x2={chartWidth}
                y2={yScale(tick)}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Box plots */}
          {data.map((boxData, index) => {
            const x = xScale(index);
            const stats = calculateBoxPlotStats(boxData.values);
            
            if (boxData.values.length === 0) return null;

            return (
              <g key={boxData.dayName}>
                {/* Whiskers */}
                <line
                  x1={x}
                  y1={yScale(stats.min)}
                  x2={x}
                  y2={yScale(stats.q1)}
                  stroke="#374151"
                  strokeWidth={2}
                />
                <line
                  x1={x}
                  y1={yScale(stats.q3)}
                  x2={x}
                  y2={yScale(stats.max)}
                  stroke="#374151"
                  strokeWidth={2}
                />

                {/* Whisker caps */}
                <line
                  x1={x - boxWidth/4}
                  y1={yScale(stats.min)}
                  x2={x + boxWidth/4}
                  y2={yScale(stats.min)}
                  stroke="#374151"
                  strokeWidth={2}
                />
                <line
                  x1={x - boxWidth/4}
                  y1={yScale(stats.max)}
                  x2={x + boxWidth/4}
                  y2={yScale(stats.max)}
                  stroke="#374151"
                  strokeWidth={2}
                />

                {/* Box */}
                <rect
                  x={x - boxWidth/2}
                  y={yScale(stats.q3)}
                  width={boxWidth}
                  height={yScale(stats.q1) - yScale(stats.q3)}
                  fill="#dbeafe"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />

                {/* Median line */}
                <line
                  x1={x - boxWidth/2}
                  y1={yScale(stats.median)}
                  x2={x + boxWidth/2}
                  y2={yScale(stats.median)}
                  stroke="#1d4ed8"
                  strokeWidth={3}
                />

                {/* Outliers */}
                {stats.outliers.map((outlier, outlierIndex) => (
                  <circle
                    key={`${boxData.dayName}-outlier-${outlierIndex}`}
                    cx={x}
                    cy={yScale(outlier)}
                    r={3}
                    fill="#ef4444"
                    stroke="#dc2626"
                    strokeWidth={1}
                  />
                ))}

                {/* Day label */}
                <text
                  x={x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="12"
                  fontWeight="500"
                >
                  {boxData.dayName.slice(0, 3)}
                </text>

                {/* Data count */}
                <text
                  x={x}
                  y={chartHeight + 35}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="10"
                >
                  n={boxData.values.length}
                </text>
              </g>
            );
          })}

          {/* Y-axis */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth={2}
          />

          {/* Y-axis labels */}
          {yTicks.map(tick => (
            <text
              key={tick}
              x={-10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#374151"
              fontSize="11"
            >
              {formatCurrency(tick)}
            </text>
          ))}

          {/* X-axis */}
          <line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth={2}
          />
        </g>

        {/* Title */}
        <text
          x={width / 2}
          y={25}
          textAnchor="middle"
          fill="#111827"
          fontSize="16"
          fontWeight="600"
        >
          Weekly Transaction Median Distribution
        </text>

        {/* Y-axis label */}
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          fill="#374151"
          fontSize="12"
          fontWeight="500"
          transform={`rotate(-90, 20, ${height / 2})`}
        >
          Transaction Amount
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-blue-200 border-2 border-blue-500"></div>
          <span>IQR (25th-75th percentile)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-700"></div>
          <span>Median</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-gray-700"></div>
          <span>Min/Max (excluding outliers)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span>Outliers</span>
        </div>
      </div>
    </div>
  );
}