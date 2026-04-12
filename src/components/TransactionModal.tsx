"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { DailyTileData, TransactionItem } from "@/utils/analysisDataUtils";
import {
  ServedOrderData,
  SelectedOption,
  fetchOrdersByDate,
  parseTimestampString,
  calculateTimeDiffMinutes,
} from "@/utils/hourlyHistogramUtils";
import { firebaseConfig } from "@/config/firebase";
import useMediaQuery from "@/utils/useMediaQuery";
import { formatCurrency } from "@/utils/formatters";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tile: DailyTileData | null;
}

type PaymentFilter = "All" | "Cash" | "QRIS" | "Online";

/* ── Shared sub-components (matching ServedOrdersTile design) ── */

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

const toTitleCase = (str: string) =>
  str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

const CustomerNamePill = ({
  name,
  isMember,
}: {
  name: string;
  isMember: boolean;
}) => {
  const trimmed = name.trim();
  if (!trimmed && !isMember) return null;

  const displayName = trimmed ? toTitleCase(trimmed) : "Member";
  const tooltipText = trimmed
    ? `${displayName}${isMember ? " · Member" : ""}`
    : isMember
    ? "Member"
    : "Not a member";

  return (
    <Tooltip text={tooltipText}>
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
          isMember
            ? "bg-purple-50 text-purple-700 border border-purple-200"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        <PersonIcon className={isMember ? "text-purple-500" : "text-gray-400"} />
        <span className="truncate max-w-[110px]">{displayName}</span>
      </div>
    </Tooltip>
  );
};

const QuantityBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center h-5 min-w-[24px] px-1.5 rounded text-gray-600 text-xs font-bold tabular-nums">
    {children}
  </span>
);

const formatFriendlyTime = (minutes: number): string => {
  if (minutes < 1) return "< 1m";
  const totalMinutes = Math.floor(minutes);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/* ── Order Card ── */

const OrderCard = ({ order }: { order: ServedOrderData }) => {
  const waktuPesanDate = order.waktuPesan
    ? parseTimestampString(order.waktuPesan)
    : null;
  const serveTimeMinutes =
    waktuPesanDate && order.timestampServe
      ? calculateTimeDiffMinutes(waktuPesanDate, order.timestampServe.toDate())
      : order.serveTimeMinutes;

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CustomerBadge number={order.customerNumber} />
          <CustomerNamePill
            name={order.namaCustomer}
            isMember={order.isMember}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip
            text={`Served at ${order.timestampServe
              .toDate()
              .toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`}
          >
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
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
                {formatFriendlyTime(serveTimeMinutes)}
              </span>
            </div>
          </Tooltip>
        </div>
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
  );
};

/* ── Main Modal ── */

export default function TransactionModal({
  isOpen,
  onClose,
  tile,
}: TransactionModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sortByQuantity, setSortByQuantity] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "orders">("items");
  const [orders, setOrders] = useState<ServedOrderData[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("All");
  const [memberOnly, setMemberOnly] = useState(false);

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

  // Reset state when tile changes
  useEffect(() => {
    if (tile) {
      setActiveTab("items");
      setOrders([]);
      setPaymentFilter("All");
      setMemberOnly(false);
    }
  }, [tile?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch orders when switching to the orders tab
  useEffect(() => {
    if (activeTab === "orders" && tile && orders.length === 0 && !isOrdersLoading) {
      setIsOrdersLoading(true);
      fetchOrdersByDate(db, tile.date)
        .then(setOrders)
        .finally(() => setIsOrdersLoading(false));
    }
  }, [activeTab, tile, orders.length, isOrdersLoading]);

  if (!isOpen || !tile) return null;

  const formatDateLong = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // --- Items tab helpers ---
  const excludedItemNames = new Set([
    "subTotal", "totalCash", "totalQris", "totalOnline",
    "actualCash", "actualOnline", "actualQris",
    "closingCash", "closingOnline", "closingQris",
  ]);
  const displayItems = tile.items.filter(
    (item) => !excludedItemNames.has(item.name)
  );
  const voucherItems = displayItems.filter((item) =>
    item.name.toLowerCase().includes("voucher")
  );
  const regularItems = displayItems.filter(
    (item) => !item.name.toLowerCase().includes("voucher")
  );
  const foodItems = regularItems.filter((item) => item.category === "food");
  const beverageItems = regularItems.filter(
    (item) => item.category === "beverage"
  );

  const sortItems = (items: TransactionItem[]) => {
    if (sortByQuantity) {
      return [...items].sort((a, b) => b.quantity - a.quantity);
    }
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  };

  const renderItemGroup = (
    title: string,
    items: TransactionItem[],
    accent = false
  ) => {
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
              <span className="text-gray-800 font-medium flex-1">
                {item.name}
              </span>
              <span className="text-slate-600 font-bold text-lg ml-4">
                {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Orders tab helpers ---
  const baseOrders = memberOnly
    ? orders.filter((o) => o.isMember)
    : orders;
  const filteredOrders =
    paymentFilter === "All"
      ? baseOrders
      : baseOrders.filter((o) => o.paymentMethod === paymentFilter);

  const paymentCounts = {
    All: baseOrders.length,
    Cash: baseOrders.filter((o) => o.paymentMethod === "Cash").length,
    QRIS: baseOrders.filter((o) => o.paymentMethod === "QRIS").length,
    Online: baseOrders.filter((o) => o.paymentMethod === "Online").length,
  };
  const memberCount = orders.filter((o) => o.isMember).length;

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
              ? "bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[85vh]"
              : "bg-white rounded-t-3xl h-[90vh] w-full"
          }
          relative flex flex-col transition-all duration-300 ease-in-out transform-gpu
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
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                {formatDateLong(tile.date)}
              </h3>
              <div className="text-3xl font-bold text-emerald-600">
                {formatCurrency(tile.originalTotal)}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors ml-4"
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

          {/* Tabs */}
          <div className="flex items-center justify-between mt-4 border-b border-gray-100 -mb-6 pb-0">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("items")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
                  activeTab === "items"
                    ? "text-gray-900 border-gray-900"
                    : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"
                }`}
              >
                Items
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    activeTab === "items"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {displayItems.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
                  activeTab === "orders"
                    ? "text-gray-900 border-gray-900"
                    : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"
                }`}
              >
                Orders
                {orders.length > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                      activeTab === "orders"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {orders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Sort toggle (only visible on Items tab) */}
            {activeTab === "items" && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSortByQuantity(true)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    sortByQuantity
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Qty
                </button>
                <button
                  onClick={() => setSortByQuantity(false)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    !sortByQuantity
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  A-Z
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 flex-1 overflow-y-auto">
          {/* ── ITEMS TAB ── */}
          {activeTab === "items" && (
            <>
              {displayItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-400 text-5xl mb-4">📊</div>
                  <p className="text-gray-500 text-lg">
                    No items found for this date
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderItemGroup("Vouchers", voucherItems, true)}
                  {renderItemGroup("Beverages", beverageItems)}
                  {renderItemGroup("Food", foodItems)}
                </div>
              )}
            </>
          )}

          {/* ── ORDERS TAB ── */}
          {activeTab === "orders" && (
            <>
              {/* Filters */}
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                {(["All", "Cash", "QRIS", "Online"] as PaymentFilter[]).map(
                  (method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentFilter(method)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        paymentFilter === method
                          ? "bg-gray-800 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {method}
                      <span
                        className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                          paymentFilter === method
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {paymentCounts[method]}
                      </span>
                    </button>
                  )
                )}

                <div className="w-px h-5 bg-gray-200" />

                <button
                  onClick={() => setMemberOnly(!memberOnly)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    memberOnly
                      ? "bg-purple-700 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <PersonIcon className={memberOnly ? "text-purple-200" : "text-gray-400"} />
                  Member
                  <span
                    className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                      memberOnly
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {memberCount}
                  </span>
                </button>
              </div>

              {isOrdersLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-100 overflow-hidden"
                    >
                      <div className="bg-gray-50 px-3 py-2 h-10 animate-pulse" />
                      <div className="p-2 space-y-1">
                        <div className="h-8 bg-gray-100 rounded animate-pulse" />
                        <div className="h-8 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center text-gray-400 py-14 text-sm">
                  {orders.length === 0
                    ? "No orders found for this date"
                    : `No ${memberOnly ? "member " : ""}${paymentFilter === "All" ? "" : paymentFilter + " "}orders found`}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
