"use client";

import { useState } from "react";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  increment,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { firebaseConfig } from "@/config/firebase";
import { useTestingMode } from "@/contexts/TestingModeContext";
import Sidebar from "@/components/Sidebar";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function MigrationPage() {
  const { isTestingMode } = useTestingMode();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const runMigration = async () => {
    setStatus("running");
    setLogs([]);
    addLog(`Starting migration (Testing Mode: ${isTestingMode})...`);

    try {
      const prefix = isTestingMode ? "zTesting_" : "";
      const transColl = collection(db, `${prefix}DailyTransaction`);
      const snapshot = await getDocs(transColl);
      
      addLog(`Found ${snapshot.size} documents in DailyTransaction.`);

      // We will process in batches of 500 (Firestore limit)
      let batch = writeBatch(db);
      let count = 0;
      let totalProcessed = 0;

      // Track totals for Monthly/Yearly aggregates
      const monthlyAggregates: Record<string, any> = {};
      const yearlyAggregates: Record<string, any> = {};

      for (const d of snapshot.docs) {
        const data = d.data();
        const dateId = d.id; // e.g. "2026-05-08"
        const monthId = dateId.substring(0, 7); // "2026-05"
        const yearId = dateId.substring(0, 4); // "2026"

        // Map fields
        const systemSalesCash = data.totalCash ?? 0;
        const systemSalesQris = data.totalQris ?? 0;
        const systemSalesOnline = data.totalOnline ?? 0;

        const reportData = {
          date: dateId,
          month: monthId,
          systemSalesCash,
          systemSalesQris,
          systemSalesOnline,
          actualCash: data.actualCash ?? systemSalesCash,
          actualQris: data.actualQris ?? systemSalesQris,
          actualOnline: data.actualOnline ?? systemSalesOnline,
          discrepancyCash: data.discrepancyCash ?? 0,
          discrepancyQris: data.discrepancyQris ?? 0,
          discrepancyOnline: data.discrepancyOnline ?? 0,
          closingCash: data.closingCash ?? systemSalesCash,
          closingQris: data.closingQris ?? systemSalesQris,
          closingOnline: data.closingOnline ?? systemSalesOnline,
          isDiscrepancyConfirmed: data.isDiscrepancyConfirmed ?? false,
          updatedAt: Timestamp.now(),
        };

        // Add anchors if they exist
        if (data.anchorCash !== undefined) (reportData as any).anchorCash = data.anchorCash;
        if (data.anchorQris !== undefined) (reportData as any).anchorQris = data.anchorQris;
        if (data.anchorOnline !== undefined) (reportData as any).anchorOnline = data.anchorOnline;

        // Write Daily Report
        const reportRef = doc(db, `${prefix}DailyFinancialReport`, dateId);
        batch.set(reportRef, reportData);

        // Track aggregates for this batch
        if (!monthlyAggregates[monthId]) {
          monthlyAggregates[monthId] = { cash: 0, qris: 0, online: 0 };
        }
        if (!yearlyAggregates[yearId]) {
          yearlyAggregates[yearId] = { cash: 0, qris: 0, online: 0 };
        }

        monthlyAggregates[monthId].cash += systemSalesCash;
        monthlyAggregates[monthId].qris += systemSalesQris;
        monthlyAggregates[monthId].online += systemSalesOnline;

        yearlyAggregates[yearId].cash += systemSalesCash;
        yearlyAggregates[yearId].qris += systemSalesQris;
        yearlyAggregates[yearId].online += systemSalesOnline;

        count++;
        totalProcessed++;

        if (count >= 400) {
          addLog(`Committing batch of ${count}...`);
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      // Update Monthly/Yearly totals (using a separate batch for safety)
      addLog("Updating Monthly and Yearly aggregates...");
      const aggBatch = writeBatch(db);
      
      for (const [mId, totals] of Object.entries(monthlyAggregates)) {
        const mRef = doc(db, `${prefix}MonthlyFinancialReport`, mId);
        aggBatch.set(mRef, {
          totalSystemSalesCash: totals.cash,
          totalSystemSalesQris: totals.qris,
          totalSystemSalesOnline: totals.online,
          updatedAt: Timestamp.now()
        }, { merge: true });
      }

      for (const [yId, totals] of Object.entries(yearlyAggregates)) {
        const yRef = doc(db, `${prefix}YearlyFinancialReport`, yId);
        aggBatch.set(yRef, {
          totalSystemSalesCash: totals.cash,
          totalSystemSalesQris: totals.qris,
          totalSystemSalesOnline: totals.online,
          updatedAt: Timestamp.now()
        }, { merge: true });
      }

      if (count > 0 || Object.keys(monthlyAggregates).length > 0) {
        await batch.commit();
        await aggBatch.commit();
      }

      addLog(`Success! Processed ${totalProcessed} documents.`);
      setStatus("success");
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Migration</h1>
        <p className="text-gray-500 mb-8">
          This will copy all data from <strong>{isTestingMode ? "zTesting_DailyTransaction" : "DailyTransaction"}</strong> 
          to the new <strong>FinancialReport</strong> collections.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Mode</p>
              <p className={`text-lg font-bold ${isTestingMode ? "text-amber-600" : "text-emerald-600"}`}>
                {isTestingMode ? "Testing Mode (zTesting_ collections)" : "Production Mode"}
              </p>
            </div>
            <button 
              onClick={runMigration}
              disabled={status === "running"}
              className={`px-8 py-4 rounded-xl font-bold text-white transition-all ${
                status === "running" ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl active:scale-95"
              }`}
            >
              {status === "running" ? "Migrating..." : "Run Migration"}
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-6 h-96 overflow-y-auto font-mono text-xs text-gray-300 space-y-1">
            {logs.length === 0 && <p className="text-gray-500 italic">Logs will appear here...</p>}
            {logs.map((log, i) => <p key={i}>{log}</p>)}
            {status === "success" && <p className="text-emerald-400 font-bold mt-4">Migration completed successfully!</p>}
            {status === "error" && <p className="text-red-400 font-bold mt-4">Migration failed. Check console for details.</p>}
          </div>
        </div>

        <p className="text-sm text-gray-400 text-center italic">
          Once finished, you can safely delete this page (`src/app/migrate/page.tsx`).
        </p>
      </div>
    </div>
  );
}
