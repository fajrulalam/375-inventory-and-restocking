"use client";

import { useEffect, useState, useMemo } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { initializeApp } from "firebase/app";
import TransactionTile from "@/components/TransactionTile";
import HourlyHistogramTile from "@/components/HourlyHistogramTile";
import ServedOrdersTile from "@/components/ServedOrdersTile";
import {
  getFormattedDate,
  getFormattedMonth,
  getFormattedYear,
  formatCurrency,
} from "@/utils/formatters";
import { getPreviousSameDayDates, calculateMedian } from "@/utils/dateUtils";
import {
  HistoricalDataItem,
  fetchMonthlyHistoricalData,
  fetchYearlyHistoricalData,
  calculateItemMedians, // Added calculateItemMedians
} from "@/utils/historicalDataUtils";
import { getCache, setCache } from "@/utils/cacheUtils";
import {
  HourlyDataItem,
  fetchTodayHourlyData,
  ServedOrderData,
  fetchTodayServedOrders,
  PendingOrderData,
  fetchPendingOrders,
  setupRealtimeUpdates,
} from "@/utils/hourlyHistogramUtils";
import { firebaseConfig } from "@/config/firebase";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface TransactionData {
  [key: string]: number | string | boolean | null | Record<string, unknown>;
  total: number;
}

export default function Home() {
  const [dailyData, setDailyData] = useState<TransactionData | null>(null);
  const [monthlyData, setMonthlyData] = useState<TransactionData | null>(null);
  const [yearlyData, setYearlyData] = useState<TransactionData | null>(null);
  const [dailyItemMedians, setDailyItemMedians] = useState<{
    [key: string]: number;
  } | null>(null);
  const [monthlyItemMedians, setMonthlyItemMedians] = useState<{
    [key: string]: number;
  } | null>(null);
  const [yearlyItemMedians, setYearlyItemMedians] = useState<{
    [key: string]: number;
  } | null>(null);
  const [medianData, setMedianData] = useState<number | null>(null);
  const [dailyHistoricalData, setDailyHistoricalData] = useState<
    HistoricalDataItem[]
  >([]);
  const [monthlyHistoricalData, setMonthlyHistoricalData] = useState<
    HistoricalDataItem[]
  >([]);
  const [yearlyHistoricalData, setYearlyHistoricalData] = useState<
    HistoricalDataItem[]
  >([]);
  const [currentWeekday, setCurrentWeekday] = useState<string>("");
  const [hourlyData, setHourlyData] = useState<HourlyDataItem[]>([]);
  const [servedOrders, setServedOrders] = useState<ServedOrderData[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrderData[]>([]);

  // Separate loading states for different queries
  const [isLoadingMainData, setIsLoadingMainData] = useState(true);
  const [isLoadingMedianData, setIsLoadingMedianData] = useState(true);
  const [isLoadingMonthlyHistory, setIsLoadingMonthlyHistory] = useState(true);
  const [isLoadingYearlyHistory, setIsLoadingYearlyHistory] = useState(true);
  const [isLoadingHourlyData, setIsLoadingHourlyData] = useState(true);
  const [isLoadingServedOrders, setIsLoadingServedOrders] = useState(true);
  const [isLoadingPendingOrders, setIsLoadingPendingOrders] = useState(true);

  // Toggle state for hiding/showing numbers
  const [hideNumbers, setHideNumbers] = useState(false);

  // Function to handle toggling the hide numbers feature
  const toggleHideNumbers = () => {
    setHideNumbers((prev) => !prev);
  };

  // Create a today date variable at the component level to use across the component
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    // Ensure we're using Jakarta time (GMT+7)
    const jakartaOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    };
    setCurrentWeekday(today.toLocaleDateString("en-US", jakartaOptions));

    // Set up real-time updates for hourly data, served orders, and pending orders
    const setupDataUpdates = () => {
      setIsLoadingHourlyData(true);
      setIsLoadingServedOrders(true);
      setIsLoadingPendingOrders(true);

      try {
        // Initial data fetch
        const initialDataFetch = async () => {
          try {
            // Fetch initial hourly data
            const hourlyItems = await fetchTodayHourlyData(db);
            setHourlyData(hourlyItems);
            setIsLoadingHourlyData(false);

            // Fetch initial served orders
            const servedItems = await fetchTodayServedOrders(db);
            setServedOrders(servedItems);
            setIsLoadingServedOrders(false);

            // Fetch initial pending orders
            const pendingItems = await fetchPendingOrders(db);
            setPendingOrders(pendingItems);
            setIsLoadingPendingOrders(false);
          } catch (error) {
            console.error("Error fetching initial data:", error);
            setIsLoadingHourlyData(false);
            setIsLoadingServedOrders(false);
            setIsLoadingPendingOrders(false);
          }
        };

        initialDataFetch();

        // Set up real-time listeners
        const unsubscribe = setupRealtimeUpdates(
          db,
          setHourlyData,
          setServedOrders,
          setPendingOrders
        );

        // Return cleanup function
        return unsubscribe;
      } catch (error) {
        console.error("Error setting up real-time updates:", error);
        setIsLoadingHourlyData(false);
        setIsLoadingServedOrders(false);
        setIsLoadingPendingOrders(false);
        return () => {}; // Empty cleanup function
      }
    };

    const fetchMainTransactions = async () => {
      setIsLoadingMainData(true);
      setDailyItemMedians(null);
      setMonthlyItemMedians(null);
      setYearlyItemMedians(null);

      try {
        const todayFormatted = getFormattedDate(today);
        const currentMonthFormatted = getFormattedMonth(today);
        const currentYearFormatted = getFormattedYear(today);

        // Daily
        const dailyRef = doc(db, "DailyTransaction", todayFormatted);
        const dailySnap = await getDoc(dailyRef);
        const dailyTransactionData = dailySnap.exists()
          ? (dailySnap.data() as TransactionData)
          : { total: 0, items: {} };
        setDailyData(dailyTransactionData);
        if (
          dailyTransactionData.items &&
          Object.keys(dailyTransactionData.items).length > 0
        ) {
          const medians = await calculateItemMedians(
            db,
            "DailyTransaction",
            Object.keys(dailyTransactionData.items)
          );
          setDailyItemMedians(medians);
        } else {
          setDailyItemMedians({});
        }

        // Monthly
        const monthlyRef = doc(db, "MonthlyTransaction", currentMonthFormatted);
        const monthlySnap = await getDoc(monthlyRef);
        const monthlyTransactionData = monthlySnap.exists()
          ? (monthlySnap.data() as TransactionData)
          : { total: 0, items: {} };
        setMonthlyData(monthlyTransactionData);
        if (
          monthlyTransactionData.items &&
          Object.keys(monthlyTransactionData.items).length > 0
        ) {
          const medians = await calculateItemMedians(
            db,
            "MonthlyTransaction",
            Object.keys(monthlyTransactionData.items)
          );
          setMonthlyItemMedians(medians);
        } else {
          setMonthlyItemMedians({});
        }

        // Yearly
        const yearlyRef = doc(db, "YearlyTransaction", currentYearFormatted);
        const yearlySnap = await getDoc(yearlyRef);
        const yearlyTransactionData = yearlySnap.exists()
          ? (yearlySnap.data() as TransactionData)
          : { total: 0, items: {} };
        setYearlyData(yearlyTransactionData);
        if (
          yearlyTransactionData.items &&
          Object.keys(yearlyTransactionData.items).length > 0
        ) {
          const medians = await calculateItemMedians(
            db,
            "YearlyTransaction",
            Object.keys(yearlyTransactionData.items)
          );
          setYearlyItemMedians(medians);
        } else {
          setYearlyItemMedians({});
        }
      } catch (error) {
        console.error(
          "Error fetching main transactions or item medians:",
          error
        );
        setDailyData({ total: 0, items: {} });
        setMonthlyData({ total: 0, items: {} });
        setYearlyData({ total: 0, items: {} });
        setDailyItemMedians({});
        setMonthlyItemMedians({});
        setYearlyItemMedians({});
      } finally {
        setIsLoadingMainData(false);
      }
    };

    const fetchDailyHistoricalData = async () => {
      setIsLoadingMedianData(true);
      try {
        // Check if we have cached data first
        const medianCacheKey = `daily-historical-data-${currentWeekday}`;
        const historicalCacheKey = `historical-daily-${currentWeekday}`;

        const cachedMedianData = getCache<number[]>(medianCacheKey);
        const cachedHistoricalData =
          getCache<HistoricalDataItem[]>(historicalCacheKey);

        if (cachedMedianData && cachedHistoricalData) {
          console.log(
            `Using cached daily historical data for ${currentWeekday}`
          );
          setMedianData(calculateMedian(cachedMedianData));
          setDailyHistoricalData(cachedHistoricalData);
        } else {
          console.log(
            `Fetching historical data for ${currentWeekday} in Jakarta time...`
          );

          // Fetch previous same-day transactions for median calculation
          const jakartaToday = new Date(today.getTime());
          jakartaToday.setHours(jakartaToday.getHours()); // Adjust for GMT+7

          console.log(`Current Jakarta date: ${jakartaToday.toISOString()}`);
          const previousDates = getPreviousSameDayDates(today, 24); // Get more dates to ensure we have enough

          const previousTotals: number[] = [];
          const historicalItems: HistoricalDataItem[] = [];
          let foundDates = 0;

          // We only need up to 8 previous dates, but we'll try to get more in case some are missing
          for (const date of previousDates) {
            if (foundDates >= 8) break; // Stop once we have 8 dates

            // Get transactions for the previous date
            const docRef = doc(db, "DailyTransaction", date);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const data = docSnap.data() as TransactionData;
              const dailyTotal = data?.total || 0;

              // Ensure we're getting valid data
              if (dailyTotal > 0) {
                previousTotals.push(dailyTotal);
                historicalItems.push({
                  date,
                  total: dailyTotal,
                });
                foundDates++;
                console.log(
                  `Found data for ${date}: ${formatCurrency(dailyTotal)}`
                );
              }
            }
          }

          // Cache the data if we found any
          if (previousTotals.length > 0) {
            setCache(medianCacheKey, previousTotals);
            setCache(historicalCacheKey, historicalItems);
          }

          // Calculate and set the median value
          if (previousTotals.length > 0) {
            console.log(
              `Calculating median from ${previousTotals.length} previous ${currentWeekday}s`
            );
            setMedianData(calculateMedian(previousTotals));
            setDailyHistoricalData(historicalItems);
          } else {
            console.log(`No previous data found for ${currentWeekday}s`);
            setMedianData(null);
            setDailyHistoricalData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching daily historical data:", error);
        setMedianData(null);
        setDailyHistoricalData([]);
      } finally {
        setIsLoadingMedianData(false);
      }
    };

    const fetchMonthlyHistoricalDataFromFirestore = async () => {
      setIsLoadingMonthlyHistory(true);
      try {
        // Check cache first
        const cacheKey = "monthly-historical-data";
        const cachedData = getCache<HistoricalDataItem[]>(cacheKey);

        if (cachedData) {
          console.log("Using cached monthly historical data");
          setMonthlyHistoricalData(cachedData);
        } else {
          console.log("Fetching monthly historical data from Firestore");
          const data = await fetchMonthlyHistoricalData(db);
          setMonthlyHistoricalData(data);

          // Cache the data if we found any
          if (data.length > 0) {
            setCache(cacheKey, data);
          }
        }
      } catch (error) {
        console.error("Error fetching monthly historical data:", error);
      } finally {
        setIsLoadingMonthlyHistory(false);
      }
    };

    const fetchYearlyHistoricalDataFromFirestore = async () => {
      setIsLoadingYearlyHistory(true);
      try {
        // Check cache first
        const cacheKey = "yearly-historical-data";
        const cachedData = getCache<HistoricalDataItem[]>(cacheKey);

        if (cachedData) {
          console.log("Using cached yearly historical data");
          setYearlyHistoricalData(cachedData);
        } else {
          console.log("Fetching yearly historical data from Firestore");
          const data = await fetchYearlyHistoricalData(db);
          setYearlyHistoricalData(data);

          // Cache the data if we found any
          if (data.length > 0) {
            setCache(cacheKey, data);
          }
        }
      } catch (error) {
        console.error("Error fetching yearly historical data:", error);
      } finally {
        setIsLoadingYearlyHistory(false);
      }
    };

    // Execute all data fetching in parallel
    fetchMainTransactions();
    fetchDailyHistoricalData();
    fetchMonthlyHistoricalDataFromFirestore();
    fetchYearlyHistoricalDataFromFirestore();

    // Set up real-time updates for hourly data, served orders, and pending orders
    return setupDataUpdates();
  }, [today, currentWeekday]);

  // Calculate medians for monthly and yearly data using last 8 data points
  const monthlyMedian =
    monthlyHistoricalData && monthlyHistoricalData.length > 0
      ? calculateMedian(monthlyHistoricalData.map((item) => item.total))
      : null;
  const yearlyMedian =
    yearlyHistoricalData && yearlyHistoricalData.length > 0
      ? calculateMedian(yearlyHistoricalData.map((item) => item.total))
      : null;

  return (
    <div className="min-h-screen bg-white text-black">
      {" "}
      {/* Main container: white background, black text */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-10 pb-6 border-b border-gray-300">
          {" "}
          {/* Increased bottom margin and padding, lighter border */}
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white flex items-center">
            <Image
              src="/assets/375_logo.png"
              alt="375 Logo"
              width={32}
              height={32}
              className="mr-3"
            />
            Transaction Overview
          </h1>
          <button
            onClick={toggleHideNumbers}
            className="flex items-center px-4 py-2 text-sm font-medium border-2 border-red-500 rounded-lg shadow-sm text-black bg-white hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-all duration-150 ease-in-out transform hover:scale-105"
          >
            {hideNumbers ? (
              <>
                <svg // Eye-slash icon
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2" // Added margin for better spacing
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                Hide Values
              </>
            ) : (
              <>
                <svg // Eye icon
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2" // Added margin for better spacing
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Show Values
              </>
            )}
          </button>
        </div>

        {/* Transaction Tiles Grid */}
        {/* Added a bit more gap for a cleaner look */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <TransactionTile
            title="Today's Transactions"
            data={dailyData}
            isLoading={isLoadingMainData}
            hideNumbers={hideNumbers}
            subtitle={
              medianData
                ? `Median (last 8 ${currentWeekday}s): ${formatCurrency(
                    medianData
                  )}`
                : undefined
            }
            isLoadingSubtitle={isLoadingMedianData}
            historicalData={dailyHistoricalData}
            periodType="daily"
            periodLabel={currentWeekday}
            yAxisInterval={100000} // 100k intervals for daily chart
            collectionName="DailyTransaction"
            documentId={getFormattedDate(today)}
            itemMedians={dailyItemMedians || {}}
          />
          <TransactionTile
            title="This Month's Transactions"
            data={monthlyData}
            isLoading={isLoadingMainData}
            hideNumbers={hideNumbers}
            subtitle={
              monthlyMedian && monthlyHistoricalData.length > 0
                ? `Median (last ${
                    monthlyHistoricalData.length
                  } months): ${formatCurrency(monthlyMedian)}`
                : undefined
            }
            isLoadingSubtitle={isLoadingMonthlyHistory}
            historicalData={monthlyHistoricalData}
            periodType="monthly"
            periodLabel="Month"
            yAxisInterval={2500000} // 2M intervals for monthly chart
            collectionName="MonthlyTransaction"
            documentId={getFormattedMonth(today)}
            itemMedians={monthlyItemMedians || {}}
          />
          <TransactionTile
            title="This Year's Transactions"
            data={yearlyData}
            isLoading={isLoadingMainData}
            hideNumbers={hideNumbers}
            subtitle={
              yearlyMedian && yearlyHistoricalData.length > 0
                ? `Median (${
                    yearlyHistoricalData.length
                  } years): ${formatCurrency(yearlyMedian)}`
                : undefined
            }
            isLoadingSubtitle={isLoadingYearlyHistory}
            historicalData={yearlyHistoricalData}
            periodType="yearly"
            periodLabel="Year"
            yAxisInterval={50000000} // 5M intervals for yearly chart
            collectionName="YearlyTransaction"
            documentId={getFormattedYear(today)}
            itemMedians={yearlyItemMedians || {}}
          />
        </div>

        {/* Hourly Histogram Row */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <HourlyHistogramTile
            data={hourlyData}
            isLoading={isLoadingHourlyData}
            yAxisInterval={15} // 15 items intervals for hourly chart
          />
          <ServedOrdersTile
            title="Today's Orders"
            servedOrders={servedOrders}
            pendingOrders={pendingOrders}
            isLoading={isLoadingServedOrders}
            isPendingLoading={isLoadingPendingOrders}
          />
        </div>
      </div>
    </div>
  );
}
