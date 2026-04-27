"use client";

import { useEffect, useState, useCallback } from "react";
import { getFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import Image from "next/image";
import Link from "next/link";
import DatePicker from "@/components/DatePicker";
import DailyTransactionListItem from "@/components/DailyTransactionListItem";
import WeeklyMedianCard from "@/components/WeeklyMedianCard";
import TransactionModal from "@/components/TransactionModal";
import WeeklyMedianModal from "@/components/WeeklyMedianModal";
import BoxPlotModal from "@/components/BoxPlotModal";
import ItemFilter from "@/components/ItemFilter";
import Sidebar from "@/components/Sidebar";
import { firebaseConfig } from "@/config/firebase";
import {
  fetchAnalysisData,
  transformToTileDataWithFilter,
  calculateWeeklyMediansWithFilter,
  DailyTileData,
  WeeklyMedianData,
  DateRange,
  DailyTransactionData
} from "@/utils/analysisDataUtils";
import { useTestingMode } from "@/contexts/TestingModeContext";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function AnalyseHistoricalData() {
  const { isTestingMode, toggleTestingMode } = useTestingMode();
  const [dailyTiles, setDailyTiles] = useState<DailyTileData[]>([]);
  const [weeklyMedians, setWeeklyMedians] = useState<WeeklyMedianData[]>([]);
  const [selectedDays, setSelectedDays] = useState<number>(14);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTile, setSelectedTile] = useState<DailyTileData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWeeklyMedian, setSelectedWeeklyMedian] = useState<WeeklyMedianData | null>(null);
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [isBoxPlotModalOpen, setIsBoxPlotModalOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isFilterDisabled, setIsFilterDisabled] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<DailyTransactionData[]>([]);

  const loadData = async (days: number) => {
    setIsLoading(true);
    try {
      const result = await fetchAnalysisData(db, days);
      setRawTransactions(result.rawTransactions || []);
      setDateRange(result.dateRange);
      setAvailableItems(result.availableItems);
      
      // Apply current filter
      applyFilter(result.rawTransactions || []);
    } catch (error) {
      console.error("Error loading analysis data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilter = useCallback((transactions: DailyTransactionData[]) => {
    if (isFilterDisabled || !selectedItem) {
      // No filter applied - use original data processing
      setDailyTiles(transformToTileDataWithFilter(transactions));
      setWeeklyMedians(calculateWeeklyMediansWithFilter(transactions));
    } else {
      // Apply filter
      setDailyTiles(transformToTileDataWithFilter(transactions, selectedItem));
      setWeeklyMedians(calculateWeeklyMediansWithFilter(transactions, selectedItem));
    }
  }, [isFilterDisabled, selectedItem]);

  useEffect(() => {
    loadData(selectedDays);
  }, [selectedDays, isTestingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filter when filter state changes
  useEffect(() => {
    if (rawTransactions.length > 0) {
      applyFilter(rawTransactions);
    }
  }, [selectedItem, isFilterDisabled, rawTransactions, applyFilter]);

  const handleTileClick = (tile: DailyTileData) => {
    setSelectedTile(tile);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTile(null);
  };

  const handleWeeklyMedianClick = (weeklyData: WeeklyMedianData) => {
    setSelectedWeeklyMedian(weeklyData);
    setIsWeeklyModalOpen(true);
  };

  const handleWeeklyModalClose = () => {
    setIsWeeklyModalOpen(false);
    setSelectedWeeklyMedian(null);
  };

  const handleBoxPlotClick = () => {
    setIsBoxPlotModalOpen(true);
  };

  const handleBoxPlotModalClose = () => {
    setIsBoxPlotModalOpen(false);
  };

  const handleDaysChange = (days: number) => {
    setSelectedDays(days);
  };

  const handleItemChange = (item: string | null) => {
    setSelectedItem(item);
  };

  const handleFilterDisabledChange = (disabled: boolean) => {
    setIsFilterDisabled(disabled);
    if (disabled) {
      setSelectedItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all duration-150"
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
              width={32}
              height={32}
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Historical Analysis
              </h1>
              <p className="text-xs text-gray-400">Insights & Trends</p>
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
            <Link
              href="/"
              className="flex items-center px-4 py-2 text-sm font-semibold rounded-xl text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-200 shadow-sm"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Date Picker Section */}
        <div className="mb-12">
          <DatePicker
            selectedDays={selectedDays}
            onDaysChange={handleDaysChange}
            dateRange={dateRange}
            isLoading={isLoading}
          />
        </div>

        {/* Item Filter Section */}
        <div className="mb-12">
          <ItemFilter
            items={availableItems}
            selectedItem={selectedItem}
            onItemChange={handleItemChange}
            isDisabled={isFilterDisabled}
            onDisabledChange={handleFilterDisabledChange}
          />
        </div>

        {/* Weekly Median Cards */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              Weekly Overview
            </h2>
            <button
              onClick={handleBoxPlotClick}
              disabled={isLoading || weeklyMedians.length === 0}
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              View Distribution
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {weeklyMedians.map((weeklyData) => (
              <WeeklyMedianCard
                key={weeklyData.dayName}
                dayName={weeklyData.dayName}
                median={weeklyData.median}
                isLoading={isLoading}
                onClick={() => handleWeeklyMedianClick(weeklyData)}
                isFiltered={!isFilterDisabled && selectedItem !== null}
              />
            ))}
          </div>
        </div>

        {/* Daily Transaction List */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            Daily Breakdown
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: selectedDays }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 bg-gray-200 animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {dailyTiles.map((tile) => (
                <DailyTransactionListItem
                  key={tile.date}
                  tile={tile}
                  onClick={() => handleTileClick(tile)}
                  isFiltered={!isFilterDisabled && selectedItem !== null}
                />
              ))}
            </div>
          )}
        </div>

        {/* Transaction Modal */}
        <TransactionModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          tile={selectedTile}
        />

        {/* Weekly Median Modal */}
        <WeeklyMedianModal
          isOpen={isWeeklyModalOpen}
          onClose={handleWeeklyModalClose}
          dayName={selectedWeeklyMedian?.dayName || ''}
          median={selectedWeeklyMedian?.median || 0}
          calculationData={selectedWeeklyMedian?.calculationData || []}
          isFiltered={!isFilterDisabled && selectedItem !== null}
        />

        {/* Box Plot Modal */}
        <BoxPlotModal
          isOpen={isBoxPlotModalOpen}
          onClose={handleBoxPlotModalClose}
          weeklyData={weeklyMedians}
          selectedDays={selectedDays}
        />
      </div>
    </div>
  );
}