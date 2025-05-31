"use client";

import { useState, useEffect, useRef } from "react";
import useMediaQuery from "@/utils/useMediaQuery";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { formatCurrency } from "@/utils/formatters";
import HistoricalDataModal from "./HistoricalDataModal";
import { HistoricalDataItem, TimePeriod } from "@/utils/historicalDataUtils";

// Helper function to mask a number with asterisks
const maskNumber = (value: number): string => {
  const valueStr = value.toString();
  return "*".repeat(valueStr.length);
};

interface TransactionData {
  [key: string]: any;
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

    console.log(`Setting up listener for ${collectionName}/${documentId}`);
    setIsLoading(true);

    // Create real-time listener
    const unsubscribe = onSnapshot(
      doc(db, collectionName, documentId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const newData = docSnapshot.data() as TransactionData;
          console.log(
            `Document updated: ${collectionName}/${documentId}`,
            newData
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
            `Document does not exist: ${collectionName}/${documentId}`
          );
          previousTotalRef.current = 0;
          setData({ total: 0 });
        }
        setIsLoading(false);
      },
      (error) => {
        console.error(
          `Error listening to ${collectionName}/${documentId}:`,
          error
        );
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log(`Unsubscribing from ${collectionName}/${documentId}`);
      unsubscribe();
    };
  }, [collectionName, documentId, isLoading]);
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
  ];

  const filteredEntries = data
    ? Object.entries(data).filter(([key]) => !excludedKeys.includes(key))
    : [];

  return (
    <>
      <div
        className={`
          p-6 rounded-lg shadow-md bg-white 
          transition-all duration-200 
          flex flex-col gap-2
          ${isUpdated ? "animate-tile-update" : ""}
        `}
      >
        <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
        {isLoading ? (
          <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
        ) : data ? (
          <>
            <div
              onClick={() => data && setIsModalOpen(true)}
              className={`${data ? "cursor-pointer hover:opacity-80" : ""}`}
            >
              <p className="text-2xl font-bold text-gray-900">
                {hideNumbers
                  ? `Rp ${maskNumber(data.total)}`
                  : formatCurrency(data.total)}
              </p>
            </div>

            {isLoadingSubtitle ? (
              <div className="mt-1 animate-pulse h-4 bg-gray-200 rounded w-48"></div>
            ) : (
              subtitle && (
                <div
                  className="inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p
                    className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 hover:underline"
                    onClick={() => {
                      if (historicalData && historicalData.length > 0) {
                        setIsHistoricalModalOpen(true);
                      }
                    }}
                  >
                    {subtitle}
                  </p>
                </div>
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
          <p className="text-sm text-gray-500">No data available</p>
        )}
      </div>

      {/* Responsive Modal (Bottom Sheet on Mobile, Dialog on Desktop) */}
      {isModalOpen && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`
              ${
                isDesktop
                  ? "bg-white/80 backdrop-blur-md rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh]"
                  : "fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md rounded-t-2xl max-h-[80vh] w-full"
              }
              p-6 overflow-y-auto transition-all duration-300 ease-in-out
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {!isDesktop && (
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
            )}
            <h3 className="text-xl font-bold mb-4">{title} Breakdown</h3>
            {/* Header Row */}
            <div className="grid grid-cols-3 gap-4 mb-2 pb-2 border-b font-semibold text-gray-700">
              <div className="text-left">Item</div>
              <div className="text-right">Quantity</div>
              <div className="text-right">Median</div>
            </div>
            <div className="space-y-3">
              {filteredEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-3 gap-4 items-center border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-gray-600 capitalize text-left truncate">{key}</span>
                  <span className="font-semibold text-right">
                    {typeof value === "number"
                      ? hideNumbers
                        ? maskNumber(value)
                        : value.toLocaleString()
                      : value}
                  </span>
                  <span className="font-semibold text-right text-gray-500">
                    {itemMedians && typeof itemMedians[key] === 'number'
                      ? hideNumbers
                        ? maskNumber(itemMedians[key])
                        : itemMedians[key].toLocaleString()
                      : '-'}
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
