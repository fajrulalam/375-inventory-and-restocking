"use client";

import { useEffect, useState } from "react";
import { DailyTileData, TransactionItem } from "@/utils/analysisDataUtils";
import useMediaQuery from "@/utils/useMediaQuery";
import { formatCurrency } from "@/utils/formatters";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tile: DailyTileData | null;
}

export default function TransactionModal({
  isOpen,
  onClose,
  tile
}: TransactionModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sortByQuantity, setSortByQuantity] = useState(true); // true = quantity desc, false = alphabetical

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen || !tile) return null;

  // Format date as "EEE, dd MMMM YYYY"
  const formatDateLong = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Separate voucher items from regular items
  const voucherItems = tile.items.filter(item => 
    item.name.toLowerCase().includes('voucher')
  );
  const regularItems = tile.items.filter(item => 
    !item.name.toLowerCase().includes('voucher')
  );

  // Group regular items by category
  const foodItems = regularItems.filter(item => item.category === 'food');
  const beverageItems = regularItems.filter(item => item.category === 'beverage');

  // Sort function
  const sortItems = (items: TransactionItem[]) => {
    if (sortByQuantity) {
      return [...items].sort((a, b) => b.quantity - a.quantity);
    } else {
      return [...items].sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const renderItemGroup = (title: string, items: TransactionItem[], accent = false) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8">
        {accent && (
          <div className="flex items-center mb-4">
            <div className="h-px bg-gradient-to-r from-amber-400 to-orange-400 flex-1"></div>
            <h4 className="text-sm font-bold text-amber-600 px-4 uppercase tracking-wider">
              {title}
            </h4>
            <div className="h-px bg-gradient-to-r from-orange-400 to-amber-400 flex-1"></div>
          </div>
        )}
        {!accent && (
          <h4 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-wider border-l-4 border-blue-400 pl-4">
            {title}
          </h4>
        )}
        <div className="space-y-1">
          {sortItems(items).map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex justify-between items-center py-4 px-5 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <span className="text-gray-800 font-medium flex-1">{item.name}</span>
              <span className="text-slate-600 font-bold text-lg ml-4">
                {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm bg-black/30 p-0 md:p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`
          ${
            isDesktop
              ? "bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh]"
              : "bg-white rounded-t-3xl max-h-[90vh] w-full"
          }
          relative overflow-y-auto transition-all duration-300 ease-in-out transform-gpu
          ${
            isOpen
              ? isDesktop
                ? "scale-100 opacity-100"
                : "translate-y-0 opacity-100"
              : isDesktop
              ? "scale-95 opacity-0"
              : "translate-y-full opacity-0"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag indicator */}
        {!isDesktop && (
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-6" />
        )}

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                {formatDateLong(tile.date)}
              </h3>
              <div className="text-3xl font-bold text-emerald-600">
                {formatCurrency(tile.originalTotal)}
              </div>
            </div>
            
            {/* Sort Toggle */}
            <div className="flex items-center gap-3 ml-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortByQuantity(true)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    sortByQuantity 
                      ? 'bg-white text-gray-800 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Qty
                </button>
                <button
                  onClick={() => setSortByQuantity(false)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    !sortByQuantity 
                      ? 'bg-white text-gray-800 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  A-Z
                </button>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                aria-label="Close"
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {tile.items.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-5xl mb-4">📊</div>
              <p className="text-gray-500 text-lg">No items found for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Vouchers (at the top) */}
              {renderItemGroup("Vouchers", voucherItems, true)}
              
              {/* Beverages */}
              {renderItemGroup("Beverages", beverageItems)}
              
              {/* Food */}
              {renderItemGroup("Food", foodItems)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}