"use client";

import { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { ServedOrderData, PendingOrderData } from "@/utils/hourlyHistogramUtils";
import TabComponent, { TabContent } from "./TabComponent";
import { formatCurrency } from "@/utils/formatters";

interface ServedOrdersTileProps {
  title: string;
  servedOrders: ServedOrderData[];
  pendingOrders: PendingOrderData[];
  isLoading?: boolean;
  isPendingLoading?: boolean;
}

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
    { id: "pending", title: "Pending Orders" } // Second tab, to be implemented later
  ];

  // Update the current time every second for the timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format minutes to display as "Xm Ys"
  const formatServeTime = (minutes: number) => {
    if (minutes < 1) {
      return "< 1m";
    }
    
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    
    if (s === 0) {
      return `${m}m`;
    }
    
    return `${m}m ${s}s`;
  };
  
  // Calculate elapsed time from a timestamp to now (for pending orders)
  const getElapsedTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return "--";
    
    try {
      // Convert Firebase timestamp to milliseconds
      const orderTime = timestamp.toDate().getTime();
      const diffMs = timeNow - orderTime;
      
      const minutes = diffMs / (1000 * 60);
      return formatServeTime(minutes);
    } catch (error) {
      console.error("Error calculating elapsed time:", error);
      return "--";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md h-full relative overflow-hidden flex flex-col">
      {/* Skeleton loader */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 z-20 flex justify-center items-center">
          <div className="animate-pulse flex flex-col w-full gap-4 p-6">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-[250px] bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6 pb-3">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        
        {/* Tabs */}
        <TabComponent
          tabItems={tabItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 pt-0">
        <TabContent active={activeTab === "served"}>
          <div className="space-y-4">
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 h-10"></div>
                    <div className="px-4 py-2 space-y-2">
                      <div className="h-8 bg-gray-200 rounded"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : servedOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No served orders today
              </div>
            ) : (
              servedOrders.map((order) => (
                <div key={order.id} className="border rounded-lg overflow-hidden">
                  {/* Order header */}
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                    <div className="font-medium">
                      {order.customerNumber} ({order.namaCustomer})
                    </div>
                    <div className="text-sm">
                      {order.timestampServe.toDate().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })} 
                      <span className="ml-1 text-green-500">
                        {formatServeTime(order.serveTimeMinutes)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Order items */}
                  <div className="px-4 py-2 flex flex-wrap gap-2">
                    {order.orderItems.map((item, index) => {
                      const isTakeAway = item.orderType === 'take-away';
                      
                      return (
                        <div 
                          key={`${order.id}-${index}`} 
                          className={`p-2 rounded ${
                            isTakeAway ? 'bg-yellow-100' : 'bg-blue-100'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>{item.namaPesanan}</span>
                            <span>
                              {item.preparedQuantity}/{item.quantity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabContent>
        
        <TabContent active={activeTab === "pending"}>
          <div className="space-y-4">
            {isPendingLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 h-10"></div>
                    <div className="px-4 py-2 space-y-2">
                      <div className="h-8 bg-gray-200 rounded"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No pending orders
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="border rounded-lg overflow-hidden">
                  {/* Order header */}
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                    <div className="font-medium">
                      {order.customerNumber} ({order.namaCustomer})
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="text-gray-600 mr-2">{order.status}</span>
                      <span className="font-medium text-orange-500">
                        {getElapsedTime(order.waktuPesan)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Order details */}
                  <div className="px-4 py-2 flex flex-wrap gap-2">
                    {/* Order items */}
                    {order.orderItems.map((item, index) => {
                      const isTakeAway = item.takeAwayQuantity > 0;
                      const quantity = isTakeAway ? item.takeAwayQuantity : item.dineInQuantity;
                      
                      return (
                        <div 
                          key={`${order.id}-${index}`} 
                          className={`p-2 rounded ${
                            isTakeAway ? 'bg-yellow-100' : 'bg-blue-100'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>{item.namaPesanan}</span>
                            <span>{quantity}</span>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Order total */}
                    <div className="mt-3 pt-2 border-t flex justify-between text-sm">
                      <span className="font-medium">Total</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                    
                    {/* Pickup time if applicable */}
                    {order.waktuPengambilan && order.waktuPengambilan !== "Tidak Memesan" && (
                      <div className="text-sm text-gray-600">
                        <span>Pickup: {order.waktuPengambilan}</span>
                      </div>
                    )}
                  </div>
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
