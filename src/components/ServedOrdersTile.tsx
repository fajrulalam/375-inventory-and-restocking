"use client";

import { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { ServedOrderData, PendingOrderData, SelectedOption } from "@/utils/hourlyHistogramUtils";
import TabComponent, { TabContent } from "./TabComponent";
import { formatCurrency } from "@/utils/formatters";

interface ServedOrdersTileProps {
  title: string;
  servedOrders: ServedOrderData[];
  pendingOrders: PendingOrderData[];
  isLoading?: boolean;
  isPendingLoading?: boolean;
}

const PersonIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${className}`}>
    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
  </svg>
);

const ClockIcon = ({ className = "" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${className}`}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
  </svg>
);

const OptionPills = ({ options }: { options: SelectedOption[] }) => {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map((opt) => (
        <span
          key={opt.optionId}
          className="px-2 py-0.5 text-[11px] font-semibold bg-gray-700 text-gray-100 rounded"
        >
          {opt.optionName}
        </span>
      ))}
    </div>
  );
};

const CustomerBadge = ({ number }: { number: string | number }) => (
  <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-gray-800 text-white text-xs font-bold tabular-nums shadow-sm">
    {number}
  </span>
);

const CustomerNamePill = ({ name, isMember }: { name: string; isMember: boolean }) => {
  const trimmed = name.trim();
  if (!trimmed && !isMember) return null;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium ${
      isMember
        ? "bg-purple-50 text-purple-700 border border-purple-200"
        : "bg-gray-100 text-gray-600"
    }`}>
      <PersonIcon className={isMember ? "text-purple-500" : "text-gray-400"} />
      <span className="truncate max-w-[130px]">
        {trimmed || "Member"}
      </span>
    </div>
  );
};

const QuantityBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center h-6 min-w-[32px] px-2 rounded-md bg-white text-gray-800 text-xs font-bold border border-gray-200 tabular-nums shadow-sm">
    {children}
  </span>
);

const ServedOrdersTile = ({
  title,
  servedOrders,
  pendingOrders,
  isLoading = false,
  isPendingLoading = false
}: ServedOrdersTileProps) => {
  const [activeTab, setActiveTab] = useState<string>("served");
  const [timeNow, setTimeNow] = useState<number>(Date.now());

  const tabItems = [
    { id: "served", title: "Served Orders" },
    { id: "pending", title: "Pending Orders" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatServeTime = (minutes: number) => {
    if (minutes < 1) return "< 1m";
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  };

  const getElapsedTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return "--";
    try {
      const orderTime = timestamp.toDate().getTime();
      const diffMs = timeNow - orderTime;
      return formatServeTime(diffMs / (1000 * 60));
    } catch (error) {
      console.error("Error calculating elapsed time:", error);
      return "--";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full relative overflow-hidden flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-white z-20 flex justify-center items-center">
          <div className="animate-pulse flex flex-col w-full gap-4 p-6">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-[250px] bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      )}

      <div className="p-6 pb-3">
        <h2 className="text-sm font-medium text-gray-500 mb-4">{title}</h2>
        <TabComponent
          tabItems={tabItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="flex-1 overflow-auto p-6 pt-0">

        {/* ── SERVED ORDERS TAB ──────────────────────────────────────── */}
        <TabContent active={activeTab === "served"}>
          <div className="space-y-3">
            {servedOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-14 text-sm">
                No served orders today
              </div>
            ) : (
              servedOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 bg-gray-50/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <CustomerBadge number={order.customerNumber} />
                      <CustomerNamePill name={order.namaCustomer} isMember={order.isMember} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                      <ClockIcon className="text-gray-400" />
                      <span className="tabular-nums">
                        {order.timestampServe.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-semibold text-emerald-600 tabular-nums">
                        {formatServeTime(order.serveTimeMinutes)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2">
                    {order.orderItems.map((item, index) => {
                      const isTakeAway = item.orderType === "take-away";
                      return (
                        <div
                          key={`${order.id}-${index}`}
                          className={`rounded-lg p-3 ${
                            isTakeAway
                              ? "bg-amber-50 border border-amber-100"
                              : "bg-blue-50 border border-blue-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-gray-900 text-sm">{item.namaPesanan}</span>
                            <QuantityBadge>{item.preparedQuantity}/{item.quantity}</QuantityBadge>
                          </div>
                          <OptionPills options={item.selectedOptions || []} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabContent>

        {/* ── PENDING ORDERS TAB ─────────────────────────────────────── */}
        <TabContent active={activeTab === "pending"}>
          <div className="space-y-3">
            {isPendingLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 h-12" />
                    <div className="p-3 space-y-2">
                      <div className="h-12 bg-gray-100 rounded-lg" />
                      <div className="h-12 bg-gray-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-14 text-sm">
                No pending orders
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 bg-gray-50/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <CustomerBadge number={order.customerNumber} />
                      <CustomerNamePill name={order.namaCustomer} isMember={order.isMember} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs shrink-0">
                      <ClockIcon className="text-orange-400" />
                      <span className="font-semibold text-orange-500 tabular-nums">
                        {getElapsedTime(order.waktuPesan)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2">
                    {order.orderItems.map((item, index) => {
                      const isTakeAway = item.takeAwayQuantity > 0;
                      const quantity = isTakeAway ? item.takeAwayQuantity : item.dineInQuantity;
                      return (
                        <div
                          key={`${order.id}-${index}`}
                          className={`rounded-lg p-3 ${
                            isTakeAway
                              ? "bg-amber-50 border border-amber-100"
                              : "bg-blue-50 border border-blue-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-gray-900 text-sm">{item.namaPesanan}</span>
                            <QuantityBadge>&times;{quantity}</QuantityBadge>
                          </div>
                          <OptionPills options={item.selectedOptions || []} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 flex items-center justify-between border-t border-dashed border-gray-200/80">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Total</span>
                    <span className="text-base font-bold text-gray-900">{formatCurrency(order.total)}</span>
                  </div>

                  {order.waktuPengambilan && order.waktuPengambilan !== "Tidak Memesan" && (
                    <div className="px-4 pb-3 -mt-1">
                      <span className="text-xs text-gray-400">Pickup: {order.waktuPengambilan}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabContent>
      </div>
    </div>
  );
};

export default ServedOrdersTile;
