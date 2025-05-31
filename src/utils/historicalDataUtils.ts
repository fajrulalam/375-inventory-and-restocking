"use client";

import { calculateMedian } from './dateUtils';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp,
  getFirestore
} from "firebase/firestore";
import { getFormattedMonth, getFormattedYear } from './formatters';

export interface HistoricalDataItem {
  date: string;
  total: number;
  isToday?: boolean;
  isCurrent?: boolean;
}

// Time periods supported by the historical data
export type TimePeriod = 'daily' | 'monthly' | 'yearly';

// Get today's formatted date in Asia/Jakarta timezone
export const getTodayFormattedDate = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  };

  // Using 'sv-SE' locale often gives YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat("sv-SE", options);
  const parts = formatter.formatToParts(now);

  // Ensure parts are correctly ordered for YYYY-MM-DD
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
};

// Get current month formatted (YYYY-MM)
export const getCurrentFormattedMonth = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
  };
  
  const formatter = new Intl.DateTimeFormat("sv-SE", options);
  const parts = formatter.formatToParts(now);
  
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }`;
};

// Get current year formatted (YYYY)
export const getCurrentFormattedYear = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    timeZone: "Asia/Jakarta",
  };
  
  const formatter = new Intl.DateTimeFormat("sv-SE", options);
  const parts = formatter.formatToParts(now);
  
  return parts.find((p) => p.type === "year")?.value || "";
};

// Process historical data and handle adding today's data if needed
export const processHistoricalData = (
  data: HistoricalDataItem[],
  actualCurrentTotal?: number,
  placeholderValue: number = 100000,
  period: TimePeriod = 'daily'
): {
  chartData: HistoricalDataItem[];
  currentExists: boolean;
  hasActualCurrentData: boolean;
} => {
  // Sort data chronologically (oldest to newest)
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentFormatted: string;
  
  // Determine current period's formatted date
  switch (period) {
    case 'monthly':
      currentFormatted = getCurrentFormattedMonth();
      break;
    case 'yearly':
      currentFormatted = getCurrentFormattedYear();
      break;
    case 'daily':
    default:
      currentFormatted = getTodayFormattedDate();
      break;
  }
  
  // Determine if current period's data truly exists and its value
  const hasActualCurrentData = typeof actualCurrentTotal === 'number';
  const currentExists = hasActualCurrentData || sortedData.some((item) => 
    item.date === currentFormatted && item.total > 0
  );

  let chartData = [...sortedData];
  const currentEntryIndex = chartData.findIndex(item => item.date === currentFormatted);

  if (hasActualCurrentData) {
    if (currentEntryIndex !== -1) {
      // Update current entry if it exists in historical data
      chartData[currentEntryIndex] = { 
        ...chartData[currentEntryIndex], 
        total: actualCurrentTotal, 
        isCurrent: true 
      };
    } else {
      // Add current entry with actual total if not found in historical
      chartData.push({
        date: currentFormatted,
        total: actualCurrentTotal,
        isCurrent: true,
      });
    }
  } else if (currentEntryIndex === -1) {
    // No actual data for current period, and not found in historical: use placeholder
    chartData.push({
      date: currentFormatted,
      total: placeholderValue,
      isCurrent: true,
    });
  } else {
    // Found in historical, but no actualCurrentTotal was passed - mark it as current
    chartData[currentEntryIndex] = { ...chartData[currentEntryIndex], isCurrent: true };
  }

  // Re-sort to ensure current period is correctly placed
  chartData = chartData.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Ensure 'isCurrent' is correctly set on the final chartData
  chartData = chartData.map(item => ({
    ...item,
    isCurrent: item.date === currentFormatted,
    isToday: period === 'daily' && item.date === currentFormatted // For backward compatibility
  }));

  return {
    chartData,
    currentExists,
    hasActualCurrentData
  };
};

// Format chart data with user-friendly date format
export const formatChartData = (
  data: HistoricalDataItem[],
  format: TimePeriod = 'daily'
): HistoricalDataItem[] => {
  return data.map((item) => {
    const date = new Date(item.date);
    let formattedDate = '';
    
    switch (format) {
      case 'monthly':
        formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric"
        });
        break;
      case 'yearly':
        formattedDate = date.toLocaleDateString("en-US", {
          year: "numeric"
        });
        break;
      case 'daily':
      default:
        formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        break;
    }
    
    return {
      ...item,
      date: formattedDate
    };
  });
};

// Calculate chart statistics
export const calculateChartStatistics = (
  data: HistoricalDataItem[], 
  yAxisInterval: number = 100000
) => {
  // Filter out today's data and data marked as current
  const historicalData = data.filter(item => !item.isCurrent && !item.isToday);
  
  // Get all the totals for max value calculation
  const allTotals = data.map(item => item.total);
  const dataMaxValue = Math.max(...allTotals, 0);
  
  // For median, only use historical data (no today/current)
  const historicalTotals = historicalData.map(item => item.total);
  const medianValue = calculateMedian(historicalTotals);
  
  // Calculate max y-axis value (round up to nearest interval)
  const maxYAxis = Math.max(yAxisInterval, Math.ceil(dataMaxValue / yAxisInterval) * yAxisInterval);

  // Generate y-axis tick values with the specified interval, starting from 0
  const yAxisTicks: number[] = [];
  for (let i = 0; i <= maxYAxis; i += yAxisInterval) {
    yAxisTicks.push(i);
  }

  return {
    maxYAxis,
    yAxisTicks,
    medianValue,
    dataMaxValue
  };
};

// Fetch monthly historical data
export const fetchMonthlyHistoricalData = async (db: any, count: number = 12): Promise<HistoricalDataItem[]> => {
  try {
    const monthlyCollection = collection(db, "MonthlyTransaction");
    const q = query(
      monthlyCollection,
      orderBy("timestamp", "desc"),
      limit(count)
    );
    
    const querySnapshot = await getDocs(q);
    const historicalItems: HistoricalDataItem[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      historicalItems.push({
        date: doc.id, // The ID is the YYYY-MM format
        total: data.total || 0,
        isCurrent: doc.id === getCurrentFormattedMonth()
      });
    });
    
    // Sort oldest to newest
    return historicalItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error("Error fetching monthly historical data:", error);
    return [];
  }
};

// Fetch yearly historical data
export const fetchYearlyHistoricalData = async (db: any): Promise<HistoricalDataItem[]> => {
  try {
    const yearlyCollection = collection(db, "YearlyTransaction");
    const q = query(
      yearlyCollection,
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const historicalItems: HistoricalDataItem[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      historicalItems.push({
        date: doc.id, // The ID is the YYYY format
        total: data.total || 0,
        isCurrent: doc.id === getCurrentFormattedYear()
      });
    });
    
    // Sort oldest to newest
    return historicalItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error("Error fetching yearly historical data:", error);
    return [];
  }
};

// Calculate median quantities for a list of items from historical data
export const calculateItemMedians = async (
  db: any, // Firestore instance
  collectionName: string, // e.g., "DailyTransaction", "MonthlyTransaction", "YearlyTransaction"
  itemKeys: string[], // Array of item keys (e.g., ["itemA", "itemB"])
  count: number = 12 // Number of historical documents to fetch (ensures at least 8 for median if available)
): Promise<{ [key: string]: number }> => {
  if (!itemKeys || itemKeys.length === 0) {
    console.log(`calculateItemMedians: No item keys provided for ${collectionName}`);
    return {};
  }

  console.log(`calculateItemMedians: Processing ${itemKeys.length} items for ${collectionName}`, itemKeys);
  const itemMedians: { [key: string]: number } = {};

  try {
    const dataCollection = collection(db, collectionName);
    let q;

    if (collectionName === "DailyTransaction") {
      q = query(
        dataCollection,
        orderBy("__name__", "desc"), // Order by document ID (date string like "YYYY-MM-DD")
        limit(count)
      );
    } else {
      // Assumes 'MonthlyTransaction' and 'YearlyTransaction' have a 'timestamp' field
      q = query(
        dataCollection,
        orderBy("timestamp", "desc"),
        limit(count)
      );
    }

    console.log(`Executing query for ${collectionName} with limit ${count}`);
    const querySnapshot = await getDocs(q);
    console.log(`Retrieved ${querySnapshot.size} documents from ${collectionName}`);
    
    const historicalDocsData: any[] = [];
    querySnapshot.forEach((doc) => {
      // Add document ID to the data for better debugging
      const data = doc.data();
      historicalDocsData.push({
        id: doc.id,
        ...data
      });
    });

    // Docs are fetched in descending order (newest first). Reverse to get oldest first for calculateMedian.
    const orderedDocsData = historicalDocsData.reverse();

    // Log a sample document to see its structure
    if (orderedDocsData.length > 0) {
      console.log(`Sample document from ${collectionName}:`, {
        id: orderedDocsData[0].id,
        hasItems: !!orderedDocsData[0].items,
        itemsType: orderedDocsData[0].items ? typeof orderedDocsData[0].items : 'undefined',
        itemsKeys: orderedDocsData[0].items ? Object.keys(orderedDocsData[0].items) : []
      });
    }

    for (const itemKey of itemKeys) {
      const quantities: number[] = [];
      for (const docData of orderedDocsData) {
        if (docData && docData.items && typeof docData.items[itemKey] === 'number') {
          quantities.push(docData.items[itemKey]);
        }
      }
      
      console.log(`${collectionName} - ${itemKey}: Found ${quantities.length} historical quantities`);
      if (quantities.length > 0) {
        // Log some of the quantities for debugging
        console.log(`${itemKey} quantities sample:`, quantities.slice(0, 3));
      }
      
      const medianValue = calculateMedian(quantities);
      console.log(`${itemKey} median value:`, medianValue);
      itemMedians[itemKey] = medianValue;
    }

    console.log(`${collectionName} final medians:`, itemMedians);

  } catch (error) {
    console.error(`Error in calculateItemMedians for ${collectionName}:`, error);
    for (const itemKey of itemKeys) {
      itemMedians[itemKey] = 0; 
    }
  }
  return itemMedians;
};