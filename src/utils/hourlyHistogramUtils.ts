"use client";

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  getFirestore,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

// Interface for hourly data
export interface HourlyDataItem {
  hour: string; // Format "8:00-9:00"
  total: number; // Sum of item quantities from RecentlyServed
  pendingTotal: number; // Sum of item quantities from Status
  revenue: number; // Sum of order revenues
  customerCount: number; // Count of unique customers
  isCurrent: boolean; // If this is the current hour
}

// Interface for order item data
export interface OrderItemData {
  namaPesanan: string;
  quantity: number;
  preparedQuantity: number;
  orderType: string;
}

// Interface for served order data
export interface ServedOrderData {
  id: string;
  customerNumber: string;
  namaCustomer: string;
  orderItems: OrderItemData[];
  waktuPesan: string; // Timestamp in string format
  timestampServe: Timestamp;
  serveTimeMinutes: number; // Time delta in minutes
}

// Interface for pending order data
export interface PendingOrderData {
  id: string;
  customerNumber: string;
  namaCustomer: string;
  orderItems: PendingOrderItemData[];
  waktuPesan: Timestamp; // Timestamp for order time
  status: string; // Current order status
  total: number;
  waktuPengambilan: string;
  bungkus?: number; // Optional field for take-away orders
}

// Interface for pending order item data
export interface PendingOrderItemData {
  namaPesanan: string;
  dineInQuantity: number;
  takeAwayQuantity: number;
  orderType?: string; // Calculated field
}

/**
 * Get Jakarta time start of day timestamp
 * Returns a Timestamp for 00:00:00 today in Jakarta time (UTC+7)
 */
export const getJakartaStartOfDay = (): Timestamp => {
  const now = new Date();
  // Set to Jakarta time zone (UTC+7)
  const jakartaOffset = 7 * 60; // UTC+7 in minutes
  const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const jakartaDate = new Date(utcDate.getTime() + jakartaOffset * 60000);

  // Set to start of day (00:00:00)
  jakartaDate.setHours(0, 0, 0, 0);

  return Timestamp.fromDate(jakartaDate);
};

/**
 * Get current hour in Jakarta time (0-23)
 */
export const getCurrentHourJakarta = (): number => {
  const now = new Date();
  // Set to Jakarta time zone (UTC+7)
  const jakartaOffset = 7 * 60; // UTC+7 in minutes
  const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const jakartaDate = new Date(utcDate.getTime() + jakartaOffset * 60000);

  return jakartaDate.getHours();
};

/**
 * Initialize hourly aggregates map for hours from 8:00 to 16:00
 */
const initializeHourlyAggregates = () => {
  interface HourlyAggregate {
    items: number;
    pendingItems: number;
    revenue: number;
    customerNumbers: Set<string>;
  }

  const hourlyAggregates: Record<string, HourlyAggregate> = {};
  for (let i = 8; i < 16; i++) {
    hourlyAggregates[`${i}:00-${i + 1}:00`] = {
      items: 0,
      pendingItems: 0,
      revenue: 0,
      customerNumbers: new Set(),
    };
  }
  return hourlyAggregates;
};

/**
 * Process served orders data and update hourly aggregates
 */
const processServedOrdersData = (querySnapshot: any, hourlyAggregates: any) => {
  querySnapshot.forEach((doc: any) => {
    const data = doc.data();

    // Check if timestampServe exists
    if (data.timestampServe) {
      // Convert Firestore timestamp to JS Date
      const date = data.timestampServe.toDate();

      // Adjust for Jakarta time
      const jakartaOffset = 7 * 60; // UTC+7 in minutes
      const utcDate = new Date(
        date.getTime() + date.getTimezoneOffset() * 60000
      );
      const jakartaDate = new Date(utcDate.getTime() + jakartaOffset * 60000);

      const hour = jakartaDate.getHours();

      // Only count items from 8AM to 4PM
      if (hour >= 8 && hour < 16) {
        const hourKey = `${hour}:00-${hour + 1}:00`;

        // Aggregate data
        if (Array.isArray(data.orderItems)) {
          data.orderItems.forEach((item: any) => {
            if (item.quantity) {
              hourlyAggregates[hourKey].items += item.quantity;
            }
          });
        }
        // Assuming data.total from "RecentlyServed" is the revenue for that order
        if (typeof data.total === "number") {
          hourlyAggregates[hourKey].revenue += data.total;
        }
        if (data.customerNumber) {
          hourlyAggregates[hourKey].customerNumbers.add(data.customerNumber);
        }
      }
    }
  });

  return hourlyAggregates;
};

/**
 * Process pending orders data and update hourly aggregates
 * Only include pending orders (not completed/cancelled) from today
 */
const processPendingOrdersData = (
  querySnapshot: any,
  hourlyAggregates: any
) => {
  // Get start of day timestamp
  const startOfDay = getJakartaStartOfDay();
  const startOfDayMs = startOfDay.toDate().getTime();

  querySnapshot.forEach((doc: any) => {
    const data = doc.data();

    // Only process orders that are not completed or cancelled
    if (
      data.status !== "completed" &&
      data.status !== "cancelled" &&
      data.waktuPesan
    ) {
      // Convert Firestore timestamp to JS Date
      let date;
      try {
        date = data.waktuPesan.toDate();
      } catch (error) {
        console.error("Error converting waktuPesan to date:", error);
        return;
      }

      // Skip orders from before today
      if (date.getTime() < startOfDayMs) {
        return;
      }

      // Adjust for Jakarta time
      const jakartaOffset = 7 * 60; // UTC+7 in minutes
      const utcDate = new Date(
        date.getTime() + date.getTimezoneOffset() * 60000
      );
      const jakartaDate = new Date(utcDate.getTime() + jakartaOffset * 60000);

      const hour = jakartaDate.getHours();

      // Only count items from 8AM to 4PM
      if (hour >= 8 && hour < 16) {
        const hourKey = `${hour}:00-${hour + 1}:00`;

        // Aggregate data
        if (Array.isArray(data.orderItems)) {
          data.orderItems.forEach((item: any) => {
            const totalQuantity =
              (item.dineInQuantity || 0) + (item.takeAwayQuantity || 0);
            if (totalQuantity > 0) {
              hourlyAggregates[hourKey].pendingItems += totalQuantity;
            }
          });
        }
      }
    }
  });

  return hourlyAggregates;
};

/**
 * Convert hourly aggregates to HourlyDataItem array
 */
const convertToHourlyDataItems = (
  hourlyAggregates: any,
  currentHour: number
): HourlyDataItem[] => {
  // Convert map to array of HourlyDataItem
  const result: HourlyDataItem[] = Object.keys(hourlyAggregates).map(
    (hourKey) => ({
      hour: hourKey,
      total: hourlyAggregates[hourKey].items,
      pendingTotal: hourlyAggregates[hourKey].pendingItems,
      revenue: hourlyAggregates[hourKey].revenue,
      customerCount: hourlyAggregates[hourKey].customerNumbers.size,
      isCurrent: parseInt(hourKey.split(":")[0]) === currentHour,
    })
  );

  // Sort by hour
  return result.sort((a, b) => {
    const hourA = parseInt(a.hour.split(":")[0]);
    const hourB = parseInt(b.hour.split(":")[0]);
    return hourA - hourB;
  });
};

/**
 * Set up real-time listeners for hourly data updates
 * @param db Firestore database instance
 * @param setHourlyData State setter for hourly data
 * @param setServedOrders State setter for served orders
 * @param setPendingOrders State setter for pending orders
 */
export const setupRealtimeUpdates = (
  db: any,
  setHourlyData: (data: HourlyDataItem[]) => void,
  setServedOrders: (data: ServedOrderData[]) => void,
  setPendingOrders: (data: PendingOrderData[]) => void
) => {
  // Start of day in Jakarta time
  const startOfDay = getJakartaStartOfDay();

  // Set up listener for RecentlyServed collection
  const recentlyServedRef = collection(db, "RecentlyServed");
  const recentlyServedQuery = query(
    recentlyServedRef,
    where("timestampServe", ">=", startOfDay),
    orderBy("timestampServe", "desc"),
    limit(50)
  );

  // Set up listener for Status collection
  const statusRef = collection(db, "Status");
  const statusQuery = query(
    statusRef,
    orderBy("waktuPesan", "desc"),
    limit(50)
  );

  // Set up real-time listeners
  const unsubscribeRecentlyServed = onSnapshot(
    recentlyServedQuery,
    (querySnapshot) => {
      // Process served orders for UI
      const servedOrders = processServedOrdersForUI(querySnapshot);
      setServedOrders(servedOrders);

      // Update hourly histogram data by fetching both collections
      updateHourlyHistogramData(db, setHourlyData);
    }
  );

  const unsubscribeStatus = onSnapshot(statusQuery, (querySnapshot) => {
    // Process pending orders for UI
    const pendingOrders = processPendingOrdersForUI(querySnapshot);
    setPendingOrders(pendingOrders);

    // Update hourly histogram data by fetching both collections
    updateHourlyHistogramData(db, setHourlyData);
  });

  // Return unsubscribe functions
  return () => {
    unsubscribeRecentlyServed();
    unsubscribeStatus();
  };
};

/**
 * Process served orders for UI display
 */
const processServedOrdersForUI = (querySnapshot: any): ServedOrderData[] => {
  const servedOrders: ServedOrderData[] = [];

  querySnapshot.forEach((doc: any) => {
    const data = doc.data();

    // Process waktuPesan timestamp string
    const waktuPesanDate = data.waktuPesan
      ? parseTimestampString(data.waktuPesan)
      : null;

    // Calculate time difference in minutes
    const serveTimeMinutes =
      waktuPesanDate && data.timestampServe
        ? calculateTimeDiffMinutes(waktuPesanDate, data.timestampServe.toDate())
        : 0;

    const orderItems = Array.isArray(data.orderItems)
      ? data.orderItems.map((item: any) => ({
          namaPesanan: item.namaPesanan || "",
          quantity: item.quantity || 0,
          preparedQuantity: item.preparedQuantity || 0,
          orderType: item.orderType || "dine-in",
        }))
      : [];

    servedOrders.push({
      id: doc.id,
      customerNumber: data.customerNumber || "",
      namaCustomer: data.namaCustomer || "",
      orderItems,
      waktuPesan: data.waktuPesan || "",
      timestampServe: data.timestampServe,
      serveTimeMinutes,
    });
  });

  return servedOrders;
};

/**
 * Process pending orders for UI display
 */
const processPendingOrdersForUI = (querySnapshot: any): PendingOrderData[] => {
  const pendingOrders: PendingOrderData[] = [];

  querySnapshot.forEach((doc: any) => {
    const data = doc.data();

    // Process order items to add orderType
    const orderItems = Array.isArray(data.orderItems)
      ? data.orderItems.map((item: any) => ({
          namaPesanan: item.namaPesanan || "",
          dineInQuantity: item.dineInQuantity || 0,
          takeAwayQuantity: item.takeAwayQuantity || 0,
          // Determine the orderType based on quantities
          orderType: item.takeAwayQuantity > 0 ? "take-away" : "dine-in",
        }))
      : [];

    pendingOrders.push({
      id: doc.id,
      customerNumber: data.customerNumber || "",
      namaCustomer: data.namaCustomer || "",
      orderItems,
      waktuPesan: data.waktuPesan || new Timestamp(0, 0),
      status: data.status || "",
      total: data.total || 0,
      waktuPengambilan: data.waktuPengambilan || "",
      bungkus: data.bungkus || 0,
    });
  });

  return pendingOrders;
};

/**
 * Update hourly histogram data by fetching both collections
 */
export const updateHourlyHistogramData = async (
  db: any,
  setHourlyData: (data: HourlyDataItem[]) => void
) => {
  try {
    // Start of day in Jakarta time
    const startOfDay = getJakartaStartOfDay();
    const currentHour = getCurrentHourJakarta();

    // Initialize hourly aggregates
    const hourlyAggregates = initializeHourlyAggregates();

    // Fetch RecentlyServed collection for today's items
    const recentlyServedRef = collection(db, "RecentlyServed");
    const recentlyServedQuery = query(
      recentlyServedRef,
      where("timestampServe", ">=", startOfDay)
    );
    const recentlyServedSnapshot = await getDocs(recentlyServedQuery);

    // Process RecentlyServed data
    processServedOrdersData(recentlyServedSnapshot, hourlyAggregates);

    // Fetch Status collection for pending orders
    const statusRef = collection(db, "Status");
    const statusQuery = query(statusRef);
    const statusSnapshot = await getDocs(statusQuery);

    // Process Status data
    processPendingOrdersData(statusSnapshot, hourlyAggregates);

    // Convert to HourlyDataItem array
    const result = convertToHourlyDataItems(hourlyAggregates, currentHour);

    // Update state
    setHourlyData(result);
  } catch (error) {
    console.error("Error updating hourly histogram data:", error);
  }
};

/**
 * Fetches today's hourly data (for backward compatibility)
 * @param db Firestore database instance
 * @returns Array of hourly data items
 */
export const fetchTodayHourlyData = async (
  db: any
): Promise<HourlyDataItem[]> => {
  try {
    // Start of day in Jakarta time
    const startOfDay = getJakartaStartOfDay();
    const currentHour = getCurrentHourJakarta();

    // Initialize hourly aggregates
    const hourlyAggregates = initializeHourlyAggregates();

    // Fetch RecentlyServed collection for today's items
    const recentlyServedRef = collection(db, "RecentlyServed");
    const recentlyServedQuery = query(
      recentlyServedRef,
      where("timestampServe", ">=", startOfDay)
    );
    const recentlyServedSnapshot = await getDocs(recentlyServedQuery);

    // Process RecentlyServed data
    processServedOrdersData(recentlyServedSnapshot, hourlyAggregates);

    // Fetch Status collection for pending orders
    const statusRef = collection(db, "Status");
    const statusQuery = query(statusRef);
    const statusSnapshot = await getDocs(statusQuery);

    // Process Status data
    processPendingOrdersData(statusSnapshot, hourlyAggregates);

    // Convert to HourlyDataItem array
    return convertToHourlyDataItems(hourlyAggregates, currentHour);
  } catch (error) {
    console.error("Error fetching hourly data:", error);
    return [];
  }
};

/**
 * Calculate histogram statistics
 * @param data The hourly data
 * @param yAxisInterval The interval for y-axis ticks
 */
export const calculateHistogramStatistics = (
  data: HourlyDataItem[],
  dataField: keyof Pick<
    HourlyDataItem,
    "total" | "revenue" | "customerCount"
  > = "total",
  yAxisInterval: number = 15
) => {
  // Find max value in the data, considering both regular and pending totals for all fields
  const maxYValue = data.reduce((max, item) => {
    // For all fields, consider the sum with pendingTotal where applicable
    // This ensures consistent stacking behavior across all tabs
    if (dataField === "total") {
      return Math.max(max, item.total + item.pendingTotal);
    } else if (dataField === "revenue") {
      // For revenue, use the actual values from both collections
      return Math.max(max, item.revenue + item.pendingTotal);
    } else if (dataField === "customerCount") {
      // For customer count, we can factor in pending customers
      // Using a simple approximation (each pending order = 1 customer)
      const pendingCustomers = item.pendingTotal > 0 ? 1 : 0;
      return Math.max(max, item.customerCount + pendingCustomers);
    }
    return Math.max(max, item[dataField]);
  }, 0);

  // Calculate max y-axis value (round up to nearest interval)
  const maxYAxis = Math.max(
    yAxisInterval,
    Math.ceil(maxYValue / yAxisInterval) * yAxisInterval
  );

  // Generate y-axis tick values with the specified interval, starting from 0
  const yAxisTicks: number[] = [];
  for (let i = 0; i <= maxYAxis; i += yAxisInterval) {
    yAxisTicks.push(i);
  }

  return {
    maxYAxis,
    yAxisTicks,
  };
};

/**
 * Parse Firebase timestamp string format
 * @param timestampStr String like "Timestamp(seconds=1747895272, nanoseconds=317000000)"
 * @returns JavaScript Date object
 */
export const parseTimestampString = (timestampStr: string): Date | null => {
  try {
    // Extract seconds from the string
    const secondsMatch = timestampStr.match(/seconds=([0-9]+)/);
    if (!secondsMatch || secondsMatch.length < 2) return null;

    const seconds = parseInt(secondsMatch[1], 10);
    return new Date(seconds * 1000); // Convert seconds to milliseconds
  } catch (error) {
    console.error("Error parsing timestamp string:", error);
    return null;
  }
};

/**
 * Calculate time difference in minutes between two dates
 */
export const calculateTimeDiffMinutes = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60));
};

/**
 * Fetches today's served orders
 * @param db Firestore database instance
 * @returns Array of served order data
 */
export const fetchTodayServedOrders = async (
  db: any
): Promise<ServedOrderData[]> => {
  try {
    // Start of day in Jakarta time
    const startOfDay = getJakartaStartOfDay();

    // Query RecentlyServed collection for today's items
    const recentlyServedRef = collection(db, "RecentlyServed");
    const q = query(
      recentlyServedRef,
      where("timestampServe", ">=", startOfDay),
      orderBy("timestampServe", "desc"),
      limit(50) // Limit to 50 most recent orders
    );

    const querySnapshot = await getDocs(q);
    return processServedOrdersForUI(querySnapshot);
  } catch (error) {
    console.error("Error fetching served orders:", error);
    return [];
  }
};

/**
 * Fetches today's pending orders
 * @param db Firestore database instance
 * @returns Array of pending order data
 */
export const fetchPendingOrders = async (
  db: any
): Promise<PendingOrderData[]> => {
  try {
    // Query Status collection for pending orders
    const statusCollection = collection(db, "Status");
    const q = query(
      statusCollection,
      // No timestamp filter as we want all pending orders regardless of when they were created
      orderBy("waktuPesan", "desc"),
      limit(50) // Limit to 50 most recent orders
    );

    const querySnapshot = await getDocs(q);
    return processPendingOrdersForUI(querySnapshot);
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    return [];
  }
};
