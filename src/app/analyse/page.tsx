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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function AnalyseHistoricalData() {
  const [dailyTiles, setDailyTiles] = useState<DailyTileData[]>([]);
  const [weeklyMedians, setWeeklyMedians] = useState<WeeklyMedianData[]>([]);
  const [selectedDays, setSelectedDays] = useState<number>(14);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  }, [selectedDays]);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center">
            <Image
              src="/assets/375_logo.png"
              alt="375 Logo"
              width={40}
              height={40}
              className="mr-4"
            />
            Historical Analysis
          </h1>
          <Link
            href="/"
            className="flex items-center px-4 py-2 text-sm font-semibold rounded-xl text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-200 shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Dashboard
          </Link>
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