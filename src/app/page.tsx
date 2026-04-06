"use client";

import { useEffect, useState, useMemo } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { initializeApp } from "firebase/app";
import TransactionTile from "@/components/TransactionTile";
import HourlyHistogramTile from "@/components/HourlyHistogramTile";
import ServedOrdersTile from "@/components/ServedOrdersTile";
import Sidebar from "@/components/Sidebar";
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
import { useTestingMode } from "@/contexts/TestingModeContext";
import { getCollectionPath } from "@/utils/testingMode";

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
  const [currentWeekday] = useState<string>(() => {
    const jakartaOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    };
    return new Date().toLocaleDateString("en-US", jakartaOptions);
  });

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

  const { isTestingMode, toggleTestingMode } = useTestingMode();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toggle state for hiding/showing numbers
  const [hideNumbers, setHideNumbers] = useState(false);

  // Function to handle toggling the hide numbers feature
  const toggleHideNumbers = () => {
    setHideNumbers((prev) => !prev);
  };

  // Create a today date variable at the component level to use across the component
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    // Current weekday is now initialized correctly

    // Set up real-time updates for hourly data, served orders, and pending orders

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
          setPendingOrders,
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
        const dailyRef = doc(
          db,
          getCollectionPath("DailyTransaction"),
          todayFormatted,
        );
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
            Object.keys(dailyTransactionData.items),
          );
          setDailyItemMedians(medians);
        } else {
          setDailyItemMedians({});
        }

        // Monthly
        const monthlyRef = doc(
          db,
          getCollectionPath("MonthlyTransaction"),
          currentMonthFormatted,
        );
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
            Object.keys(monthlyTransactionData.items),
          );
          setMonthlyItemMedians(medians);
        } else {
          setMonthlyItemMedians({});
        }

        // Yearly
        const yearlyRef = doc(
          db,
          getCollectionPath("YearlyTransaction"),
          currentYearFormatted,
        );
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
            Object.keys(yearlyTransactionData.items),
          );
          setYearlyItemMedians(medians);
        } else {
          setYearlyItemMedians({});
        }
      } catch (error) {
        console.error(
          "Error fetching main transactions or item medians:",
          error,
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
        const cachePrefix = isTestingMode ? "test_" : "";
        const medianCacheKey = `${cachePrefix}daily-historical-data-${currentWeekday}`;
        const historicalCacheKey = `${cachePrefix}historical-daily-${currentWeekday}`;

        const cachedMedianData = getCache<number[]>(medianCacheKey);
        const cachedHistoricalData =
          getCache<HistoricalDataItem[]>(historicalCacheKey);

        if (cachedMedianData && cachedHistoricalData) {
          console.log(
            `Using cached daily historical data for ${currentWeekday}`,
          );
          setMedianData(calculateMedian(cachedMedianData));
          setDailyHistoricalData(cachedHistoricalData);
        } else {
          console.log(
            `Fetching historical data for ${currentWeekday} in Jakarta time...`,
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
            const docRef = doc(db, getCollectionPath("DailyTransaction"), date);
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
                  `Found data for ${date}: ${formatCurrency(dailyTotal)}`,
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
              `Calculating median from ${previousTotals.length} previous ${currentWeekday}s`,
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
        const monthlyCacheKey = `${isTestingMode ? "test_" : ""}monthly-historical-data`;
        const cachedData = getCache<HistoricalDataItem[]>(monthlyCacheKey);

        if (cachedData) {
          console.log("Using cached monthly historical data");
          setMonthlyHistoricalData(cachedData);
        } else {
          console.log("Fetching monthly historical data from Firestore");
          const data = await fetchMonthlyHistoricalData(db);
          setMonthlyHistoricalData(data);

          if (data.length > 0) {
            setCache(monthlyCacheKey, data);
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
        const yearlyCacheKey = `${isTestingMode ? "test_" : ""}yearly-historical-data`;
        const cachedYearlyData = getCache<HistoricalDataItem[]>(yearlyCacheKey);

        if (cachedYearlyData) {
          console.log("Using cached yearly historical data");
          setYearlyHistoricalData(cachedYearlyData);
        } else {
          console.log("Fetching yearly historical data from Firestore");
          const data = await fetchYearlyHistoricalData(db);
          setYearlyHistoricalData(data);

          if (data.length > 0) {
            setCache(yearlyCacheKey, data);
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
  }, [today, currentWeekday, isTestingMode]);

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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all duration-150"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <Image
              src="/assets/375_logo.png"
              alt="375 Logo"
              width={28}
              height={28}
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Transaction Overview
              </h1>
              <p className="text-xs text-gray-400">
                {currentWeekday}, {getFormattedDate(today)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTestingMode}
              className={`p-2 rounded-xl border transition-all duration-200 ${
                isTestingMode
                  ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 ring-offset-1 shadow-sm"
                  : "text-gray-400 bg-white border-gray-100 hover:text-gray-600 hover:border-gray-200 shadow-sm"
              }`}
              title={isTestingMode ? "Testing mode ON" : "Testing mode OFF"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4.5 h-4.5"
              >
                <path
                  fillRule="evenodd"
                  d="M8.5 3.528v4.644c0 .729-.29 1.428-.805 1.944l-1.217 1.216a8.75 8.75 0 013.55.621l.502.164a12.826 12.826 0 003.78.596 8.65 8.65 0 01-6.373-.1l-.331-.125a6.75 6.75 0 00-2.94-.423L2.785 14.07c-.163.163-.163.427 0 .59l2.424 2.424c.164.164.428.164.591 0l3.072-3.072a2.75 2.75 0 011.944-.806h4.644A2.5 2.5 0 0018 10.75V9.5a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586L8.5 3.528z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              onClick={toggleHideNumbers}
              className={`p-2 rounded-xl border transition-all duration-200 shadow-sm ${
                hideNumbers
                  ? "bg-gray-800 text-white border-gray-800"
                  : "text-gray-400 bg-white border-gray-100 hover:text-gray-600 hover:border-gray-200"
              }`}
              title={hideNumbers ? "Show values" : "Hide values"}
            >
              {hideNumbers ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4.5 h-4.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
                    clipRule="evenodd"
                  />
                  <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4.5 h-4.5"
                >
                  <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  <path
                    fillRule="evenodd"
                    d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Transaction Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <TransactionTile
            title="Today's Transactions"
            data={dailyData}
            isLoading={isLoadingMainData}
            hideNumbers={hideNumbers}
            subtitle={
              medianData
                ? `Median (last 8 ${currentWeekday}s): ${formatCurrency(medianData)}`
                : undefined
            }
            isLoadingSubtitle={isLoadingMedianData}
            historicalData={dailyHistoricalData}
            periodType="daily"
            periodLabel={currentWeekday}
            yAxisInterval={100000}
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
                ? `Median (last ${monthlyHistoricalData.length} months): ${formatCurrency(monthlyMedian)}`
                : undefined
            }
            isLoadingSubtitle={isLoadingMonthlyHistory}
            historicalData={monthlyHistoricalData}
            periodType="monthly"
            periodLabel="Month"
            yAxisInterval={2500000}
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
                ? `Median (${yearlyHistoricalData.length} years): ${formatCurrency(yearlyMedian)}`
                : undefined
            }
            isLoadingSubtitle={isLoadingYearlyHistory}
            historicalData={yearlyHistoricalData}
            periodType="yearly"
            periodLabel="Year"
            yAxisInterval={50000000}
            collectionName="YearlyTransaction"
            documentId={getFormattedYear(today)}
            itemMedians={yearlyItemMedians || {}}
          />
        </div>

        {/* Hourly Data Row */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <HourlyHistogramTile
            data={hourlyData}
            isLoading={isLoadingHourlyData}
            yAxisInterval={15}
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
