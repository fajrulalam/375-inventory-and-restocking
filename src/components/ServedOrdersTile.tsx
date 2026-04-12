"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Timestamp } from "firebase/firestore";
import {
  ServedOrderData,
  PendingOrderData,
  SelectedOption,
} from "@/utils/hourlyHistogramUtils";
import { formatCurrency } from "@/utils/formatters";

const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed pointer-events-none"
            style={{
              left: coords.x,
              top: coords.y,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
            }}
          >
            <div className="mb-1.5 px-2 py-1 rounded-md bg-gray-800 text-white text-[10px] font-medium whitespace-nowrap shadow-lg">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

interface ServedOrdersTileProps {
  title: string;
  servedOrders: ServedOrderData[];
  pendingOrders: PendingOrderData[];
  isLoading?: boolean;
  isPendingLoading?: boolean;
}

const PersonIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`w-3.5 h-3.5 ${className}`}
  >
    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
  </svg>
);

const ClockIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`w-3.5 h-3.5 ${className}`}
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
      clipRule="evenodd"
    />
  </svg>
);

const AlertIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`w-3.5 h-3.5 ${className}`}
  >
    <path
      fillRule="evenodd"
      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
      clipRule="evenodd"
    />
  </svg>
);

const STALE_THRESHOLD_MINUTES = 60;

const formatFriendlyTime = (minutes: number): string => {
  if (minutes < 1) return "< 1m";
  const totalMinutes = Math.floor(minutes);

  if (totalMinutes < 60) return `${totalMinutes}m`;

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const OptionPills = ({ options }: { options: SelectedOption[] }) => {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {options.map((opt) => (
        <span
          key={opt.optionId}
          className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-md border border-gray-200"
        >
          {opt.optionName}
        </span>
      ))}
    </div>
  );
};

const CustomerBadge = ({ number }: { number: string | number }) => (
  <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-gray-800 text-white text-xs font-bold tabular-nums shadow-sm">
    #{number}
  </span>
);

const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

const CustomerNamePill = ({
  name,
  isMember,
}: {
  name: string;
  isMember: boolean;
}) => {
  const trimmed = name.trim();
  if (!trimmed && !isMember) return null;

  const display = trimmed ? toTitleCase(trimmed) : "Member";

  return (
    <Tooltip text={display}>
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
          isMember
            ? "bg-purple-50 text-purple-700 border border-purple-200"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        <PersonIcon className={isMember ? "text-purple-500" : "text-gray-400"} />
        <span className="truncate max-w-[110px]">{display}</span>
      </div>
    </Tooltip>
  );
};

const QuantityBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center h-5 min-w-[24px] px-1.5 rounded text-gray-600 text-xs font-bold tabular-nums">
    {children}
  </span>
);

interface TabItemProps {
  title: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const TabItem = ({ title, count, active, onClick }: TabItemProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
      active
        ? "text-gray-900 border-gray-900"
        : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"
    }`}
  >
    {title}
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
        active
          ? "bg-gray-800 text-white"
          : "bg-gray-200 text-gray-500"
      }`}
    >
      {count}
    </span>
  </button>
);

const ServedOrdersTile = ({
  title,
  servedOrders,
  pendingOrders,
  isLoading = false,
  isPendingLoading = false,
}: ServedOrdersTileProps) => {
  const [activeTab, setActiveTab] = useState<string>("served");
  const [timeNow, setTimeNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatServeTime = (minutes: number) => {
    return formatFriendlyTime(minutes);
  };

  const getElapsedMinutes = (timestamp: Timestamp | null): number | null => {
    if (!timestamp) return null;
    try {
      const orderTime = timestamp.toDate().getTime();
      return (timeNow - orderTime) / (1000 * 60);
    } catch {
      return null;
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

      <div className="px-6 pt-5 pb-2">
        <h2 className="text-sm font-medium text-gray-500 mb-3">{title}</h2>
        <div className="border-b border-gray-100">
          <div className="flex space-x-1">
            <TabItem
              title="Served"
              count={servedOrders.length}
              active={activeTab === "served"}
              onClick={() => setActiveTab("served")}
            />
            <TabItem
              title="Pending"
              count={pendingOrders.length}
              active={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-5">
        {/* ── SERVED ORDERS TAB ──────────────────────────────────────── */}
        {activeTab === "served" && (
          <div className="space-y-2 pt-3">
            {servedOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-14 text-sm">
                No served orders today
              </div>
            ) : (
              servedOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-gray-100 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-3 py-2 bg-gray-50/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CustomerBadge number={order.customerNumber} />
                      <CustomerNamePill
                        name={order.namaCustomer}
                        isMember={order.isMember}
                      />
                    </div>
                    <Tooltip
                      text={`Served at ${order.timestampServe
                        .toDate()
                        .toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}`}
                    >
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                        <ClockIcon className="text-gray-400" />
                        <span className="tabular-nums">
                          {order.timestampServe
                            .toDate()
                            .toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </span>
                        <span className="font-semibold text-emerald-600 tabular-nums">
                          {formatServeTime(order.serveTimeMinutes)}
                        </span>
                      </div>
                    </Tooltip>
                  </div>

                  {/* Items */}
                  <div className="px-2.5 py-2 space-y-1">
                    {order.orderItems.map((item, index) => {
                      const isTakeAway = item.orderType === "take-away";
                      return (
                        <div
                          key={`${order.id}-${index}`}
                          className={`rounded-md px-2.5 py-1.5 ${
                            isTakeAway
                              ? "bg-amber-50/70 border border-amber-100"
                              : "bg-blue-50/70 border border-blue-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900 text-sm">
                              {item.namaPesanan}
                            </span>
                            <QuantityBadge>&times;{item.quantity}</QuantityBadge>
                          </div>
                          <OptionPills options={item.selectedOptions || []} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  {order.total > 0 && (
                    <div className="px-3 py-2 flex items-center justify-between border-t border-dashed border-gray-200/80">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Total
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PENDING ORDERS TAB ─────────────────────────────────────── */}
        {activeTab === "pending" && (
          <div className="space-y-2 pt-3">
            {isPendingLoading ? (
              <div className="animate-pulse space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-100 overflow-hidden"
                  >
                    <div className="bg-gray-50 px-3 py-2 h-10" />
                    <div className="p-2 space-y-1">
                      <div className="h-8 bg-gray-100 rounded" />
                      <div className="h-8 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-14 text-sm">
                No pending orders
              </div>
            ) : (
              pendingOrders.map((order) => {
                const elapsedMin = getElapsedMinutes(order.waktuPesan);
                const isStale = elapsedMin !== null && elapsedMin >= STALE_THRESHOLD_MINUTES;

                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border overflow-hidden ${
                      isStale
                        ? "border-red-200 bg-red-50/30"
                        : "border-gray-100"
                    }`}
                  >
                    {/* Header */}
                    <div
                      className={`px-3 py-2 flex items-center justify-between gap-2 ${
                        isStale ? "bg-red-50" : "bg-gray-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CustomerBadge number={order.customerNumber} />
                        <CustomerNamePill
                          name={order.namaCustomer}
                          isMember={order.isMember}
                        />
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[11px] shrink-0 font-semibold tabular-nums ${
                          isStale ? "text-red-600" : "text-orange-500"
                        }`}
                      >
                        {isStale ? (
                          <AlertIcon className="text-red-500" />
                        ) : (
                          <ClockIcon className="text-orange-400" />
                        )}
                        <span>
                          {elapsedMin !== null
                            ? formatFriendlyTime(elapsedMin)
                            : "--"}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="px-2.5 py-2 space-y-1">
                      {order.orderItems.map((item, index) => {
                        const isTakeAway = item.takeAwayQuantity > 0;
                        const quantity = isTakeAway
                          ? item.takeAwayQuantity
                          : item.dineInQuantity;
                        return (
                          <div
                            key={`${order.id}-${index}`}
                            className={`rounded-md px-2.5 py-1.5 ${
                              isTakeAway
                                ? "bg-amber-50/70 border border-amber-100"
                                : "bg-blue-50/70 border border-blue-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-900 text-sm">
                                {item.namaPesanan}
                              </span>
                              <QuantityBadge>&times;{quantity}</QuantityBadge>
                            </div>
                            <OptionPills options={item.selectedOptions || []} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 flex items-center justify-between border-t border-dashed border-gray-200/80">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Total
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    {order.waktuPengambilan &&
                      order.waktuPengambilan !== "Tidak Memesan" && (
                        <div className="px-3 pb-2 -mt-1">
                          <span className="text-[10px] text-gray-400">
                            Pickup: {order.waktuPengambilan}
                          </span>
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServedOrdersTile;
