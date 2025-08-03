"use client";

import { Firestore, collection, query, getDocs, where } from "firebase/firestore";
import { calculateMedian } from "./dateUtils";

export interface DailyTransactionData {
  date: string;
  day: string;
  month: number;
  year: number;
  timestamp: number;
  total: number;
  customerNumber: number;
  items: Record<string, number>;
  voucher?: number;
  // Allow for additional dynamic fields that might contain items
  [key: string]: number | string | boolean | null | Record<string, unknown> | undefined;
}

export interface TransactionItem {
  name: string;
  quantity: number;
  category: 'food' | 'beverage';
}

export interface DailyTileData {
  customerNumber: number;
  date: string;
  dayOfWeek: string;
  displayDate: string;
  total: number;
  items: TransactionItem[];
}

export interface WeeklyMedianData {
  dayName: string;
  median: number;
  calculationData: {
    date: string;
    displayDate: string;
    total: number;
  }[];
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Format date to YYYY-MM-DD
export const formatDateForFirestore = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get date range for the last N days
export const getDateRange = (days: number): DateRange => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  
  return { startDate, endDate };
};

// Get abbreviated day name
export const getDayAbbreviation = (date: Date): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

// Format display date as day/month/year
export const formatDisplayDate = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Categorize items based on name patterns
export const categorizeItem = (itemName: string): 'food' | 'beverage' => {
  const lowerName = itemName.toLowerCase();
  if (lowerName.startsWith('es ') || lowerName.startsWith('kopi') || lowerName.startsWith('air')) {
    return 'beverage';
  }
  return 'food';
};

// Fetch transactions for a date range
export const fetchTransactionsByDateRange = async (
  db: Firestore,
  dateRange: DateRange
): Promise<DailyTransactionData[]> => {
  try {
    const transactionsCollection = collection(db, "DailyTransaction");
    
    // Create array of dates to query
    const dateStrings: string[] = [];
    const currentDate = new Date(dateRange.startDate);
    
    while (currentDate <= dateRange.endDate) {
      dateStrings.push(formatDateForFirestore(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const transactions: DailyTransactionData[] = [];
    
    // Fetch data for each date (Firestore doesn't support 'in' with more than 10 items)
    const batchSize = 10;
    for (let i = 0; i < dateStrings.length; i += batchSize) {
      const batch = dateStrings.slice(i, i + batchSize);
      
      const q = query(
        transactionsCollection,
        where("__name__", "in", batch)
      );
      
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Fetched transaction for ${doc.id}:`, {
          total: data.total,
          hasItems: !!data.items,
          itemsKeys: data.items ? Object.keys(data.items) : [],
          allDataKeys: Object.keys(data)
        });
        
        transactions.push({
          date: doc.id,
          day: data.day || '',
          month: data.month || 0,
          year: data.year || 0,
          timestamp: data.timestamp || 0,
          total: data.total || 0,
          items: data.items || {},
          customerNumber: data.customerNumber,
          voucher: data.voucher || 0,
          // Store the raw data for fallback processing
          ...data
        });
      });
    }
    
    // Sort by date (newest first)
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Error fetching transactions by date range:", error);
    return [];
  }
};

// Transform raw transaction data to tile format
export const transformToTileData = (transactions: DailyTransactionData[]): DailyTileData[] => {
  return transactions.map(transaction => {
    const date = new Date(transaction.date);
    const items: TransactionItem[] = [];
    
    // Define excluded keys (same as in TransactionTile.tsx)
    const excludedKeys = [
      "year", "date", "month", "timestamp", 
      "customerNumber", "total", "voucher", "day"
    ];
    
    // Process items - check both nested items field and direct fields
    const itemsData = transaction.items || {};
    
    // First, try to get items from the nested 'items' field
    if (itemsData && Object.keys(itemsData).length > 0) {
      Object.entries(itemsData).forEach(([name, quantity]) => {
        if (typeof quantity === 'number' && quantity > 0) {
          items.push({
            name,
            quantity,
            category: categorizeItem(name)
          });
        }
      });
    } else {
      // Fallback: treat the entire transaction object as items (like TransactionTile does)
      Object.entries(transaction).forEach(([key, value]) => {
        if (!excludedKeys.includes(key) && typeof value === 'number' && value > 0) {
          items.push({
            name: key,
            quantity: value,
            category: categorizeItem(key)
          });
        }
      });
    }
    
    // Don't sort here - let the modal handle sorting
    
    return {
      date: transaction.date,
      dayOfWeek: getDayAbbreviation(date),
      displayDate: formatDisplayDate(date),
      total: transaction.total,
      customerNumber: transaction.customerNumber,
      items
    };
  });
};

// Calculate weekly medians from transaction data
export const calculateWeeklyMedians = (transactions: DailyTransactionData[]): WeeklyMedianData[] => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyData: { [key: number]: { totals: number[], data: {date: string, displayDate: string, total: number}[] } } = {
    0: { totals: [], data: [] }, 1: { totals: [], data: [] }, 2: { totals: [], data: [] }, 
    3: { totals: [], data: [] }, 4: { totals: [], data: [] }, 5: { totals: [], data: [] }, 6: { totals: [], data: [] }
  };
  
  // Group transactions by day of week
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const dayOfWeek = date.getDay();
    
    if (transaction.total > 0) {
      weeklyData[dayOfWeek].totals.push(transaction.total);
      weeklyData[dayOfWeek].data.push({
        date: transaction.date,
        displayDate: formatDisplayDate(date),
        total: transaction.total
      });
    }
  });
  
  // Calculate median for each day and include calculation data
  return dayNames.map((dayName, index) => ({
    dayName,
    median: calculateMedian(weeklyData[index].totals),
    calculationData: weeklyData[index].data
  }));
};

// Main function to fetch and process analysis data
export const fetchAnalysisData = async (
  db: Firestore,
  days: number = 14
): Promise<{
  dailyTiles: DailyTileData[];
  weeklyMedians: WeeklyMedianData[];
  dateRange: DateRange;
}> => {
  try {
    const dateRange = getDateRange(days);
    const transactions = await fetchTransactionsByDateRange(db, dateRange);
    const dailyTiles = transformToTileData(transactions);
    const weeklyMedians = calculateWeeklyMedians(transactions);
    
    return {
      dailyTiles,
      weeklyMedians,
      dateRange
    };
  } catch (error) {
    console.error("Error fetching analysis data:", error);
    return {
      dailyTiles: [],
      weeklyMedians: [],
      dateRange: getDateRange(days)
    };
  }
};