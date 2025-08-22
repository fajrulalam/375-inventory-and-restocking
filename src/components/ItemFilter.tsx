"use client";

import { useState, useEffect, useRef } from "react";

interface ItemFilterProps {
  items: string[];
  selectedItem: string | null;
  onItemChange: (item: string | null) => void;
  isDisabled: boolean;
  onDisabledChange: (disabled: boolean) => void;
}

export default function ItemFilter({
  items,
  selectedItem,
  onItemChange,
  isDisabled,
  onDisabledChange
}: ItemFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter items based on search term
  const filteredItems = items.filter(item =>
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemSelect = (item: string) => {
    onItemChange(item);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClearSelection = () => {
    onItemChange(null);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleToggleDisabled = () => {
    const newDisabledState = !isDisabled;
    onDisabledChange(newDisabledState);
    if (newDisabledState) {
      onItemChange(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-2">
        <h3 className="text-lg font-semibold text-slate-800">Item Filter</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isDisabled}
            onChange={handleToggleDisabled}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Disable filter
        </label>
      </div>
      
      {!isDisabled && (
        <div className="relative" ref={dropdownRef}>
          <div
            className="min-w-0 flex-1 relative cursor-pointer bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center justify-between">
              <span className={selectedItem ? "text-gray-900" : "text-gray-500"}>
                {selectedItem || "Select an item to filter by..."}
              </span>
              <div className="flex items-center gap-2">
                {selectedItem && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearSelection();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {isOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search items..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div className="max-h-48 overflow-y-auto">
                {filteredItems.length > 0 ? (
                  <>
                    <button
                      onClick={handleClearSelection}
                      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                    >
                      Show all (no filter)
                    </button>
                    {filteredItems.map((item) => (
                      <button
                        key={item}
                        onClick={() => handleItemSelect(item)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                          selectedItem === item ? "bg-blue-100 text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No items found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {selectedItem && !isDisabled && (
        <div className="mt-2 text-sm text-blue-600">
          Filtering by: <span className="font-medium">{selectedItem}</span>
        </div>
      )}
    </div>
  );
}