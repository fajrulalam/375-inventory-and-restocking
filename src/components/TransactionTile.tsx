"use client";

import { useState, useEffect, useRef } from "react";
import useMediaQuery from "@/utils/useMediaQuery";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { formatCurrency } from "@/utils/formatters";
import HistoricalDataModal from "./HistoricalDataModal";
import { HistoricalDataItem, TimePeriod } from "@/utils/historicalDataUtils";
import { useTestingMode } from "@/contexts/TestingModeContext";
import { getCollectionPath } from "@/utils/testingMode";

// Helper function to mask a number with asterisks
const maskNumber = (value: number): string => {
  const valueStr = value.toString();
  return "*".repeat(valueStr.length);
};

interface TransactionData {
  [key: string]: number | string | boolean | null | Record<string, unknown>;
  total: number;
}

interface TransactionTileProps {
  title: string;
  data?: TransactionData | null; // Made optional since we'll fetch it directly
  isLoading?: boolean; // Made optional since we'll manage loading state internally
  subtitle?: string;
  isLoadingSubtitle?: boolean;
  hideNumbers?: boolean;
  historicalData?: HistoricalDataItem[];
  periodType?: TimePeriod;
  periodLabel?: string;
  yAxisInterval?: number;
  // New props for Firestore document reference
  collectionName: string;
  documentId: string;
  itemMedians?: { [key: string]: number };
}

export default function TransactionTile({
  title,
  data: initialData,
  isLoading: initialLoading = true,
  subtitle,
  isLoadingSubtitle,
  hideNumbers = false,
  historicalData,
  periodType = "daily",
  periodLabel = "Day",
  yAxisInterval = 100000,
  collectionName,
  documentId,
  itemMedians = {},
}: TransactionTileProps) {
  const { isTestingMode } = useTestingMode();
  const [data, setData] = useState<TransactionData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [isUpdated, setIsUpdated] = useState(false);
  const previousTotalRef = useRef<number | null>(initialData?.total || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio("/assets/cha ching sound effect download.mp3");
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Get Firestore instance
    const db = getFirestore();
    const effectiveCollection = getCollectionPath(collectionName);

    console.log(`Setting up listener for ${effectiveCollection}/${documentId}`);
    setIsLoading(true);

    // Create real-time listener
    const unsubscribe = onSnapshot(
      doc(db, effectiveCollection, documentId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const newData = docSnapshot.data() as TransactionData;
          console.log(
            `Document updated: ${effectiveCollection}/${documentId}`,
            newData,
          );

          // Check if this is a real update (not initial load) and if the total has changed
          if (
            !isLoading &&
            previousTotalRef.current !== null &&
            newData.total !== previousTotalRef.current
          ) {
            // Play sound effect
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current
                .play()
                .catch((e) => console.error("Error playing sound:", e));
            }

            // Trigger animation
            setIsUpdated(true);
            setTimeout(() => setIsUpdated(false), 1500); // Animation duration
          }

          // Update previous value reference
          previousTotalRef.current = newData.total;
          setData(newData);
        } else {
          console.log(
            `Document does not exist: ${effectiveCollection}/${documentId}`,
          );
          previousTotalRef.current = 0;
          setData({ total: 0 });
        }
        setIsLoading(false);
      },
      (error) => {
        console.error(
          `Error listening to ${effectiveCollection}/${documentId}:`,
          error,
        );
        setIsLoading(false);
      },
    );

    // Cleanup subscription on unmount
    return () => {
      console.log(`Unsubscribing from ${effectiveCollection}/${documentId}`);
      unsubscribe();
    };
  }, [collectionName, documentId, isTestingMode]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)"); // md breakpoint
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  const excludedKeys = [
    "year",
    "date",
    "month",
    "timestamp",
    "customerNumber",
    "total",
    "takeAwayFee",
    "closingQris",
    "actualCash",
    "actualQris",
    "actualOnline",
    "subTotal",
    "expensesOnline",
    "grossCash",
    "expensesCash",
    "totalQris",
    "discrepancyCash",
    "closingOnline",
    "discrepancyOnline",
    "grossOnline",
    "expensesQris",
    "discrepancyQris",
    "grossQris",
    "closingCash",
    "totalCash",
    "actualOnline",
    "subTotal",
    "expensesOnline",
    "grossCash",
    "expensesCash",
    "totalQris",
    "discrepancyCash",
    "closingOnline",
    "discrepancyOnline",
    "grossOnline",
    "expensesQris",
    "discrepancyQris",
    "grossQris",
    "closingCash",
    "totalCash",
  ];

  const filteredEntries = data
    ? Object.entries(data).filter(([key]) => !excludedKeys.includes(key))
    : [];

  return (
    <>
      <div
        className={`
          px-5 py-5 rounded-xl border border-gray-100 shadow-sm bg-white
          transition-all duration-200 flex flex-col gap-1.5
          ${isUpdated ? "animate-tile-update" : ""}
        `}
      >
        <h2 className="text-sm font-medium text-gray-500">{title}</h2>
        {isLoading ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="animate-pulse h-9 bg-gray-100 rounded-lg w-2/3"></div>
            <div className="animate-pulse h-3.5 bg-gray-100 rounded w-3/4"></div>
          </div>
        ) : data ? (
          <>
            <div
              onClick={() => data && setIsModalOpen(true)}
              className="cursor-pointer group"
            >
              <p className="text-3xl font-bold text-gray-900 tracking-tight group-hover:text-gray-700 transition-colors">
                {hideNumbers
                  ? `Rp ${maskNumber(data.total)}`
                  : formatCurrency(data.total)}
              </p>
            </div>

            {isLoadingSubtitle ? (
              <div className="animate-pulse h-3.5 bg-gray-100 rounded w-48"></div>
            ) : (
              subtitle && (
                <p
                  className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                  onClick={() => {
                    if (historicalData && historicalData.length > 0) {
                      setIsHistoricalModalOpen(true);
                    }
                  }}
                >
                  {subtitle}
                </p>
              )
            )}
            {historicalData && historicalData.length > 0 && (
              <HistoricalDataModal
                isOpen={isHistoricalModalOpen}
                onClose={() => setIsHistoricalModalOpen(false)}
                data={historicalData}
                timePeriod={periodType}
                periodLabel={periodLabel}
                actualCurrentTotal={data ? data.total : undefined}
                yAxisInterval={yAxisInterval}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No data available</p>
        )}
      </div>

      {/* Breakdown Modal */}
      {isModalOpen && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`
              ${
                isDesktop
                  ? "bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-lg w-full max-h-[90vh]"
                  : "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] w-full"
              }
              overflow-y-auto transition-all duration-300 ease-in-out
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {!isDesktop && (
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
            )}

            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {title} Breakdown
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-2.5 bg-gray-50/80 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="text-left">Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Median</div>
            </div>

            {/* Table Body */}
            <div className="px-6 pb-6 divide-y divide-gray-100">
              {filteredEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-4 items-center py-3"
                >
                  <span className="text-sm text-gray-700 capitalize truncate">
                    {key}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 text-right tabular-nums">
                    {typeof value === "number"
                      ? hideNumbers
                        ? maskNumber(value)
                        : value.toLocaleString()
                      : typeof value === "string" || typeof value === "boolean"
                        ? String(value)
                        : typeof value === "object" && value !== null
                          ? "[Object]"
                          : String(value)}
                  </span>
                  <span className="text-sm font-medium text-gray-400 text-right tabular-nums">
                    {itemMedians && typeof itemMedians[key] === "number"
                      ? hideNumbers
                        ? maskNumber(itemMedians[key])
                        : itemMedians[key].toLocaleString()
                      : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
