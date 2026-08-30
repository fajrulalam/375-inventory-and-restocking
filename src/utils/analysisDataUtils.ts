"use client";

import { Firestore, collection, query, getDocs, where } from "firebase/firestore";
import { calculateMedian } from "./dateUtils";
import { getCollectionPath } from "./testingMode";

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

export type ItemCategory = 'food' | 'beverage';
export type MenuCategoryMap = Record<string, ItemCategory>;

export interface TransactionItem {
  name: string;
  quantity: number;
  category: ItemCategory;
}

export interface DailyTileData {
  customerNumber: number;
  date: string;
  dayOfWeek: string;
  displayDate: string;
  total: number;
  originalTotal: number;
  items: TransactionItem[];
  voucherCount: number;
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

const normalizeItemName = (itemName: string): string =>
  itemName.trim().replace(/\s+/g, ' ').toLowerCase();

// MenuCollection is the source of truth for whether a menu item is food or a
// beverage. Keep both the menu name and document ID so older transactions that
// stored either value can still be categorized.
export const fetchMenuCategories = async (
  db: Firestore,
): Promise<MenuCategoryMap> => {
  try {
    const menuCollection = collection(
      db,
      getCollectionPath('Canteens/canteen375/MenuCollection'),
    );
    const querySnapshot = await getDocs(menuCollection);
    const menuCategories: MenuCategoryMap = {};

    querySnapshot.forEach((menuDocument) => {
      const data = menuDocument.data();
      if (typeof data.isMakanan !== 'boolean') return;

      const category: ItemCategory = data.isMakanan ? 'food' : 'beverage';
      const names = [menuDocument.id];
      if (typeof data.namaMenu === 'string' && data.namaMenu.trim()) {
        names.push(data.namaMenu);
      }

      names.forEach((name) => {
        const normalizedName = normalizeItemName(name);
        if (normalizedName) {
          menuCategories[normalizedName] = category;
        }
      });
    });

    return menuCategories;
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    return {};
  }
};

// Categorize an item using the isMakanan value loaded from MenuCollection.
// Menu items are expected to have a corresponding MenuCollection document;
// food is the safe fallback for legacy records without a menu match.
export const categorizeItem = (
  itemName: string,
  menuCategories: MenuCategoryMap = {},
): ItemCategory => menuCategories[normalizeItemName(itemName)] ?? 'food';

// Numeric fields on DailyTransaction that describe the transaction itself,
// rather than menu items. These must not be rendered in the item breakdown.
const nonItemTransactionFields = new Set([
  'year',
  'date',
  'month',
  'timestamp',
  'customerNumber',
  'total',
  'voucher',
  'day',
  'items',
  'takeAwayFee',
  'subTotal',
  'totalCash',
  'totalQris',
  'totalOnline',
  'totalVoucher',
  'totalVoucherSettled',
  'totalB2BRedeemed',
  'totalB2BSettled',
  // Keep compatibility with the casing used by some older records.
  'totalB2bRedeemed',
  'totalB2bSettled',
  'lastB2BSettlementAt',
  'actualCash',
  'actualQris',
  'actualOnline',
  'discrepancyCash',
  'discrepancyQris',
  'discrepancyOnline',
  'closingCash',
  'closingQris',
  'closingOnline',
  'grossCash',
  'grossQris',
  'grossOnline',
  'expensesCash',
  'expensesQris',
  'expensesOnline',
  'isDiscrepancyConfirmed',
  'preConfirmTotal',
  'preConfirmSubTotal',
  'confirmedDeltaCash',
  'confirmedDeltaQris',
  'confirmedDeltaOnline',
  'originalActualCash',
  'originalActualQris',
  'originalActualOnline',
  'originalDiscrepancyCash',
  'originalDiscrepancyQris',
  'originalDiscrepancyOnline',
  'preAnchorClosingCash',
  'preAnchorClosingQris',
  'preAnchorClosingOnline',
  'anchorCash',
  'anchorQris',
  'anchorOnline',
]);

// Fetch transactions for a date range
export const fetchTransactionsByDateRange = async (
  db: Firestore,
  dateRange: DateRange
): Promise<DailyTransactionData[]> => {
  try {
    const transactionsCollection = collection(db, getCollectionPath("DailyTransaction"));
    
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
export const transformToTileData = (
  transactions: DailyTransactionData[],
  menuCategories: MenuCategoryMap = {},
): DailyTileData[] => {
  return transactions.map(transaction => {
    const date = new Date(transaction.date);
    const items: TransactionItem[] = [];
    
    // Process items - check both nested items field and direct fields
    const itemsData = transaction.items || {};
    
    // First, try to get items from the nested 'items' field
    if (itemsData && Object.keys(itemsData).length > 0) {
      Object.entries(itemsData).forEach(([name, quantity]) => {
        if (typeof quantity === 'number' && quantity > 0) {
          items.push({
            name,
            quantity,
            category: categorizeItem(name, menuCategories)
          });
        }
      });
    } else {
      // Fallback: treat the entire transaction object as items (like TransactionTile does)
      Object.entries(transaction).forEach(([key, value]) => {
        if (!nonItemTransactionFields.has(key) && typeof value === 'number' && value > 0) {
          items.push({
            name: key,
            quantity: value,
            category: categorizeItem(key, menuCategories)
          });
        }
      });
    }
    
    // Calculate voucher count
    const voucherCount = items.filter(item => 
      item.name.toLowerCase().includes('voucher')
    ).reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      date: transaction.date,
      dayOfWeek: getDayAbbreviation(date),
      displayDate: formatDisplayDate(date),
      total: transaction.total,
      originalTotal: transaction.total,
      customerNumber: transaction.customerNumber,
      items,
      voucherCount
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

// Extract unique item keys from transactions (excluding system fields)
export const extractUniqueItems = (transactions: DailyTransactionData[]): string[] => {
  const uniqueItems = new Set<string>();
  
  transactions.forEach(transaction => {
    // Check nested items field
    if (transaction.items && typeof transaction.items === 'object') {
      Object.keys(transaction.items).forEach(key => {
        if (typeof transaction.items[key] === 'number' && transaction.items[key] > 0) {
          uniqueItems.add(key);
        }
      });
    }
    
    // Check direct properties on transaction object
    Object.entries(transaction).forEach(([key, value]) => {
      if (!nonItemTransactionFields.has(key) && typeof value === 'number' && value > 0) {
        uniqueItems.add(key);
      }
    });
  });
  
  // Convert to array and sort alphabetically
  return Array.from(uniqueItems).sort();
};

// Calculate weekly medians with optional item filter
export const calculateWeeklyMediansWithFilter = (transactions: DailyTransactionData[], selectedItem?: string): WeeklyMedianData[] => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyData: { [key: number]: { totals: number[], data: {date: string, displayDate: string, total: number}[] } } = {
    0: { totals: [], data: [] }, 1: { totals: [], data: [] }, 2: { totals: [], data: [] }, 
    3: { totals: [], data: [] }, 4: { totals: [], data: [] }, 5: { totals: [], data: [] }, 6: { totals: [], data: [] }
  };
  
  // Group transactions by day of week
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const dayOfWeek = date.getDay();
    
    let valueToUse = transaction.total;
    
    // If a specific item is selected, use that item's value instead of total
    if (selectedItem) {
      // Check nested items field first
      if (transaction.items && typeof transaction.items === 'object' && transaction.items[selectedItem]) {
        valueToUse = transaction.items[selectedItem];
      } 
      // Check direct properties
      else if (transaction[selectedItem] && typeof transaction[selectedItem] === 'number') {
        valueToUse = transaction[selectedItem] as number;
      } 
      // If item doesn't exist, use 0
      else {
        valueToUse = 0;
      }
    }
    
    if (valueToUse > 0) {
      weeklyData[dayOfWeek].totals.push(valueToUse);
      weeklyData[dayOfWeek].data.push({
        date: transaction.date,
        displayDate: formatDisplayDate(date),
        total: valueToUse
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

// Transform to tile data with optional item filter
export const transformToTileDataWithFilter = (
  transactions: DailyTransactionData[],
  selectedItem?: string,
  menuCategories: MenuCategoryMap = {},
): DailyTileData[] => {
  return transactions.map(transaction => {
    const date = new Date(transaction.date);
    const items: TransactionItem[] = [];
    
    // Process items - check both nested items field and direct fields
    const itemsData = transaction.items || {};
    
    // First, try to get items from the nested 'items' field
    if (itemsData && Object.keys(itemsData).length > 0) {
      Object.entries(itemsData).forEach(([name, quantity]) => {
        if (typeof quantity === 'number' && quantity > 0) {
          items.push({
            name,
            quantity,
            category: categorizeItem(name, menuCategories)
          });
        }
      });
    } else {
      // Fallback: treat the entire transaction object as items (like TransactionTile does)
      Object.entries(transaction).forEach(([key, value]) => {
        if (!nonItemTransactionFields.has(key) && typeof value === 'number' && value > 0) {
          items.push({
            name: key,
            quantity: value,
            category: categorizeItem(key, menuCategories)
          });
        }
      });
    }
    
    // Calculate total based on selected item or use default total
    let totalToDisplay = transaction.total;
    
    if (selectedItem) {
      // Check nested items field first
      if (transaction.items && typeof transaction.items === 'object' && transaction.items[selectedItem]) {
        totalToDisplay = transaction.items[selectedItem];
      } 
      // Check direct properties
      else if (transaction[selectedItem] && typeof transaction[selectedItem] === 'number') {
        totalToDisplay = transaction[selectedItem] as number;
      } 
      // If item doesn't exist, use 0
      else {
        totalToDisplay = 0;
      }
    }
    
    // Calculate voucher count
    const voucherCount = items.filter(item => 
      item.name.toLowerCase().includes('voucher')
    ).reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      date: transaction.date,
      dayOfWeek: getDayAbbreviation(date),
      displayDate: formatDisplayDate(date),
      total: totalToDisplay,
      originalTotal: transaction.total,
      customerNumber: transaction.customerNumber,
      items,
      voucherCount
    };
  });
};

// Main function to fetch and process analysis data
export const fetchAnalysisData = async (
  db: Firestore,
  days: number = 14
): Promise<{
  dailyTiles: DailyTileData[];
  weeklyMedians: WeeklyMedianData[];
  dateRange: DateRange;
  availableItems: string[];
  menuCategories: MenuCategoryMap;
  rawTransactions: DailyTransactionData[];
}> => {
  try {
    const dateRange = getDateRange(days);
    const [transactions, menuCategories] = await Promise.all([
      fetchTransactionsByDateRange(db, dateRange),
      fetchMenuCategories(db),
    ]);
    const dailyTiles = transformToTileData(transactions, menuCategories);
    const weeklyMedians = calculateWeeklyMedians(transactions);
    const availableItems = extractUniqueItems(transactions);
    
    return {
      dailyTiles,
      weeklyMedians,
      dateRange,
      availableItems,
      menuCategories,
      rawTransactions: transactions
    };
  } catch (error) {
    console.error("Error fetching analysis data:", error);
    return {
      dailyTiles: [],
      weeklyMedians: [],
      dateRange: getDateRange(days),
      availableItems: [],
      menuCategories: {},
      rawTransactions: []
    };
  }
};

// Function to fetch analysis data with item filter
export const fetchAnalysisDataWithFilter = async (
  db: Firestore,
  days: number = 14,
  selectedItem?: string
): Promise<{
  dailyTiles: DailyTileData[];
  weeklyMedians: WeeklyMedianData[];
  dateRange: DateRange;
  availableItems: string[];
  menuCategories: MenuCategoryMap;
}> => {
  try {
    const dateRange = getDateRange(days);
    const [transactions, menuCategories] = await Promise.all([
      fetchTransactionsByDateRange(db, dateRange),
      fetchMenuCategories(db),
    ]);
    const dailyTiles = transformToTileDataWithFilter(
      transactions,
      selectedItem,
      menuCategories,
    );
    const weeklyMedians = calculateWeeklyMediansWithFilter(transactions, selectedItem);
    const availableItems = extractUniqueItems(transactions);
    
    return {
      dailyTiles,
      weeklyMedians,
      dateRange,
      availableItems,
      menuCategories,
    };
  } catch (error) {
    console.error("Error fetching analysis data:", error);
    return {
      dailyTiles: [],
      weeklyMedians: [],
      dateRange: getDateRange(days),
      availableItems: [],
      menuCategories: {},
    };
  }
};
