import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  increment,
  writeBatch,
  deleteField,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { getCollectionPath } from "./testingMode";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountType = "cash" | "qris" | "online";

export interface CashflowRow {
  date: string;
  rawDate: string;
  description: string;
  cashAmount: number;
  cashBalance: number;
  qrisAmount: number;
  qrisBalance: number;
  onlineAmount: number;
  onlineBalance: number;
  rowType: "opening" | "sales" | "discrepancy" | "expense" | "adjustment" | "closing";
  sourceAccount?: AccountType;
  expenseTimestamp?: Date;
  addedFromDashboardWeb?: boolean;
  isDiscrepancyConfirmed?: boolean;
}

export interface OpeningBalance {
  openingCash: number;
  openingQris: number;
  openingOnline: number;
}

export interface DailyTransactionData {
  date: string;
  actualCash?: number;
  actualOnline?: number;
  actualQris?: number;
  totalCash?: number;
  totalOnline?: number;
  totalQris?: number;
  closingCash: number;
  closingOnline: number;
  closingQris: number;
  isDiscrepancyConfirmed?: boolean;
  total?: number;
  subTotal?: number;
  discrepancyCash?: number;
  discrepancyQris?: number;
  discrepancyOnline?: number;
  anchorCash?: number;
  anchorQris?: number;
  anchorOnline?: number;
}

export interface ExpenseData {
  id: string;
  amount: number;
  sourceAccount: string;
  category: string;
  timestamp: Date;
  addedFromDashboardWeb?: boolean;
}

// ---------------------------------------------------------------------------
// Firestore Queries
// ---------------------------------------------------------------------------

export async function fetchAvailableMonths(db: Firestore): Promise<string[]> {
  const ref = collection(db, getCollectionPath("MonthlyTransaction"));
  const snapshot = await getDocs(ref);
  const months: string[] = [];
  snapshot.forEach((d) => months.push(d.id));

  const now = new Date();
  const jakarta = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const current = `${jakarta.getFullYear()}-${String(jakarta.getMonth() + 1).padStart(2, "0")}`;
  if (!months.includes(current)) months.push(current);

  months.sort((a, b) => b.localeCompare(a));
  return months;
}

export function formatMonthLabel(monthId: string): string {
  const [yearStr, monthStr] = monthId.split("-");
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const label = date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const jakarta = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const current = `${jakarta.getFullYear()}-${String(jakarta.getMonth() + 1).padStart(2, "0")}`;
  return monthId === current ? `${label} (ongoing)` : label;
}

export async function fetchDailyTransactionsForMonth(
  db: Firestore,
  monthId: string
): Promise<DailyTransactionData[]> {
  const ref = collection(db, getCollectionPath("DailyTransaction"));
  const q = query(ref, where("month", "==", monthId), orderBy("date", "asc"));
  const snapshot = await getDocs(q);

  const results: DailyTransactionData[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    results.push({
      date: d.id,
      actualCash: data.actualCash,
      actualOnline: data.actualOnline,
      actualQris: data.actualQris,
      totalCash: data.totalCash,
      totalOnline: data.totalOnline,
      totalQris: data.totalQris,
      closingCash: data.closingCash ?? 0,
      closingOnline: data.closingOnline ?? 0,
      closingQris: data.closingQris ?? 0,
      isDiscrepancyConfirmed: data.isDiscrepancyConfirmed ?? false,
      total: data.total,
      subTotal: data.subTotal,
      discrepancyCash: data.discrepancyCash,
      discrepancyQris: data.discrepancyQris,
      discrepancyOnline: data.discrepancyOnline,
      anchorCash: data.anchorCash,
      anchorQris: data.anchorQris,
      anchorOnline: data.anchorOnline,
    });
  });
  return results;
}

export async function fetchExpensesForMonth(
  db: Firestore,
  monthId: string
): Promise<ExpenseData[]> {
  const [yearStr, monthStr] = monthId.split("-");
  const year = parseInt(yearStr);
  const monthIdx = parseInt(monthStr) - 1;

  // Jakarta midnight boundaries converted to UTC (Jakarta = UTC+7)
  const startUTC = new Date(
    Date.UTC(year, monthIdx, 1) - 7 * 3600 * 1000
  );
  const endUTC = new Date(
    Date.UTC(year, monthIdx + 1, 1) - 7 * 3600 * 1000
  );

  const ref = collection(db, getCollectionPath("Expenses"));
  const q = query(
    ref,
    where("timestamp", ">=", Timestamp.fromDate(startUTC)),
    where("timestamp", "<", Timestamp.fromDate(endUTC)),
    orderBy("timestamp", "asc")
  );
  const snapshot = await getDocs(q);

  const results: ExpenseData[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    results.push({
      id: d.id,
      amount: data.amount ?? 0,
      sourceAccount: data.sourceAccount ?? "",
      category: data.category ?? "Unknown",
      timestamp: data.timestamp?.toDate() ?? new Date(),
      addedFromDashboardWeb: data.addedFromDashboardWeb ?? false,
    });
  });
  return results;
}

export async function fetchOpeningBalance(
  db: Firestore,
  monthId: string
): Promise<OpeningBalance> {
  // 1. Check explicit override in CashflowSettings
  const settingsRef = doc(
    db,
    getCollectionPath("CashflowSettings"),
    monthId
  );
  const settingsSnap = await getDoc(settingsRef);

  if (settingsSnap.exists()) {
    const data = settingsSnap.data();
    return {
      openingCash: data.openingCash ?? 0,
      openingQris: data.openingQris ?? 0,
      openingOnline: data.openingOnline ?? 0,
    };
  }

  // 2. Fall back to previous month's last day closing
  const [yearStr, monthStr] = monthId.split("-");
  let prevYear = parseInt(yearStr);
  let prevMonth = parseInt(monthStr) - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthId = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const prevRef = collection(db, getCollectionPath("DailyTransaction"));
  const prevQ = query(
    prevRef,
    where("month", "==", prevMonthId),
    orderBy("date", "desc"),
    limit(1)
  );
  const prevSnap = await getDocs(prevQ);

  if (!prevSnap.empty) {
    const data = prevSnap.docs[0].data();
    return {
      openingCash: data.closingCash ?? 0,
      openingQris: data.closingQris ?? 0,
      openingOnline: data.closingOnline ?? 0,
    };
  }

  return { openingCash: 0, openingQris: 0, openingOnline: 0 };
}

export async function saveOpeningBalance(
  db: Firestore,
  monthId: string,
  balance: OpeningBalance
): Promise<void> {
  const settingsRef = doc(
    db,
    getCollectionPath("CashflowSettings"),
    monthId
  );
  await setDoc(settingsRef, balance, { merge: true });
}

export async function addExpense(
  db: Firestore,
  data: {
    amount: number;
    category: string;
    sourceAccount: string;
    canteenId?: string;
  }
): Promise<void> {
  const ref = collection(db, getCollectionPath("Expenses"));
  await addDoc(ref, {
    amount: data.amount,
    category: data.category,
    sourceAccount: data.sourceAccount,
    canteenId: data.canteenId ?? "canteen375_plazaUnipdu",
    timestamp: Timestamp.now(),
    addedFromDashboardWeb: true,
  });
}

// ---------------------------------------------------------------------------
// Discrepancy Confirm / Reject / Undo
// ---------------------------------------------------------------------------

export async function confirmDiscrepancy(
  db: Firestore,
  dateStr: string
): Promise<void> {
  const dailyRef = doc(db, getCollectionPath("DailyTransaction"), dateStr);
  const snap = await getDoc(dailyRef);
  if (!snap.exists()) throw new Error(`DailyTransaction/${dateStr} not found`);

  const data = snap.data();
  const deltaCash = data.discrepancyCash ?? 0;
  const deltaQris = data.discrepancyQris ?? 0;
  const deltaOnline = data.discrepancyOnline ?? 0;
  const totalDelta = deltaCash + deltaQris + deltaOnline;

  const oldTotal = data.total ?? 0;
  const oldSubTotal = data.subTotal ?? 0;

  const [yyyy, mm] = dateStr.split("-");
  const monthId = `${yyyy}-${mm}`;
  const yearId = yyyy;

  const batch = writeBatch(db);

  batch.update(dailyRef, {
    isDiscrepancyConfirmed: true,
    preConfirmTotal: oldTotal,
    preConfirmSubTotal: oldSubTotal,
    confirmedDeltaCash: deltaCash,
    confirmedDeltaQris: deltaQris,
    confirmedDeltaOnline: deltaOnline,
    total: oldTotal + totalDelta,
    subTotal: oldSubTotal + totalDelta,
  });

  const monthRef = doc(db, getCollectionPath("MonthlyTransaction"), monthId);
  batch.update(monthRef, {
    total: increment(totalDelta),
    totalCash: increment(deltaCash),
    totalQris: increment(deltaQris),
    totalOnline: increment(deltaOnline),
  });

  const yearRef = doc(db, getCollectionPath("YearlyTransaction"), yearId);
  batch.update(yearRef, {
    total: increment(totalDelta),
    totalCash: increment(deltaCash),
    totalQris: increment(deltaQris),
    totalOnline: increment(deltaOnline),
  });

  await batch.commit();
}

export async function rejectDiscrepancy(
  db: Firestore,
  dateStr: string,
  editedActuals: { cash: number; qris: number; online: number }
): Promise<void> {
  const dailyRef = doc(db, getCollectionPath("DailyTransaction"), dateStr);
  const snap = await getDoc(dailyRef);
  if (!snap.exists()) throw new Error(`DailyTransaction/${dateStr} not found`);

  const data = snap.data();
  const totalCash = data.totalCash ?? 0;
  const totalQris = data.totalQris ?? 0;
  const totalOnline = data.totalOnline ?? 0;

  const deltaCash = editedActuals.cash - totalCash;
  const deltaQris = editedActuals.qris - totalQris;
  const deltaOnline = editedActuals.online - totalOnline;
  const totalDelta = deltaCash + deltaQris + deltaOnline;

  const oldTotal = data.total ?? 0;
  const oldSubTotal = data.subTotal ?? 0;

  const [yyyy, mm] = dateStr.split("-");
  const monthId = `${yyyy}-${mm}`;
  const yearId = yyyy;

  const batch = writeBatch(db);

  batch.update(dailyRef, {
    isDiscrepancyConfirmed: true,
    preConfirmTotal: oldTotal,
    preConfirmSubTotal: oldSubTotal,
    confirmedDeltaCash: deltaCash,
    confirmedDeltaQris: deltaQris,
    confirmedDeltaOnline: deltaOnline,
    originalActualCash: data.actualCash,
    originalActualQris: data.actualQris,
    originalActualOnline: data.actualOnline,
    originalDiscrepancyCash: data.discrepancyCash,
    originalDiscrepancyQris: data.discrepancyQris,
    originalDiscrepancyOnline: data.discrepancyOnline,
    actualCash: editedActuals.cash,
    actualQris: editedActuals.qris,
    actualOnline: editedActuals.online,
    discrepancyCash: deltaCash,
    discrepancyQris: deltaQris,
    discrepancyOnline: deltaOnline,
    total: oldTotal + totalDelta,
    subTotal: oldSubTotal + totalDelta,
  });

  const monthRef = doc(db, getCollectionPath("MonthlyTransaction"), monthId);
  batch.update(monthRef, {
    total: increment(totalDelta),
    totalCash: increment(deltaCash),
    totalQris: increment(deltaQris),
    totalOnline: increment(deltaOnline),
  });

  const yearRef = doc(db, getCollectionPath("YearlyTransaction"), yearId);
  batch.update(yearRef, {
    total: increment(totalDelta),
    totalCash: increment(deltaCash),
    totalQris: increment(deltaQris),
    totalOnline: increment(deltaOnline),
  });

  await batch.commit();
}

export async function anchorBalance(
  db: Firestore,
  dateStr: string,
  anchors: { cash?: number; qris?: number; online?: number }
): Promise<void> {
  const dailyRef = doc(db, getCollectionPath("DailyTransaction"), dateStr);
  const snap = await getDoc(dailyRef);
  if (!snap.exists()) throw new Error(`DailyTransaction/${dateStr} not found`);

  const data = snap.data();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (anchors.cash !== undefined) {
    updates.anchorCash = anchors.cash;
    updates.preAnchorClosingCash = data.closingCash ?? 0;
    updates.closingCash = anchors.cash;
  }
  if (anchors.qris !== undefined) {
    updates.anchorQris = anchors.qris;
    updates.preAnchorClosingQris = data.closingQris ?? 0;
    updates.closingQris = anchors.qris;
  }
  if (anchors.online !== undefined) {
    updates.anchorOnline = anchors.online;
    updates.preAnchorClosingOnline = data.closingOnline ?? 0;
    updates.closingOnline = anchors.online;
  }

  const batch = writeBatch(db);
  batch.update(dailyRef, updates);
  await batch.commit();
}

export async function undoAnchor(
  db: Firestore,
  dateStr: string
): Promise<void> {
  const dailyRef = doc(db, getCollectionPath("DailyTransaction"), dateStr);
  const snap = await getDoc(dailyRef);
  if (!snap.exists()) throw new Error(`DailyTransaction/${dateStr} not found`);

  const data = snap.data();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (data.anchorCash !== undefined) {
    updates.closingCash = data.preAnchorClosingCash ?? data.closingCash;
    updates.anchorCash = deleteField();
    updates.preAnchorClosingCash = deleteField();
  }
  if (data.anchorQris !== undefined) {
    updates.closingQris = data.preAnchorClosingQris ?? data.closingQris;
    updates.anchorQris = deleteField();
    updates.preAnchorClosingQris = deleteField();
  }
  if (data.anchorOnline !== undefined) {
    updates.closingOnline = data.preAnchorClosingOnline ?? data.closingOnline;
    updates.anchorOnline = deleteField();
    updates.preAnchorClosingOnline = deleteField();
  }

  if (Object.keys(updates).length === 0) return;

  const batch = writeBatch(db);
  batch.update(dailyRef, updates);
  await batch.commit();
}

export async function undoDiscrepancyConfirmation(
  db: Firestore,
  dateStr: string
): Promise<void> {
  const dailyRef = doc(db, getCollectionPath("DailyTransaction"), dateStr);
  const snap = await getDoc(dailyRef);
  if (!snap.exists()) throw new Error(`DailyTransaction/${dateStr} not found`);

  const data = snap.data();
  const deltaCash = data.confirmedDeltaCash ?? 0;
  const deltaQris = data.confirmedDeltaQris ?? 0;
  const deltaOnline = data.confirmedDeltaOnline ?? 0;
  const totalDelta = deltaCash + deltaQris + deltaOnline;

  const [yyyy, mm] = dateStr.split("-");
  const monthId = `${yyyy}-${mm}`;
  const yearId = yyyy;

  const batch = writeBatch(db);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyUpdates: Record<string, any> = {
    isDiscrepancyConfirmed: deleteField(),
    preConfirmTotal: deleteField(),
    preConfirmSubTotal: deleteField(),
    confirmedDeltaCash: deleteField(),
    confirmedDeltaQris: deleteField(),
    confirmedDeltaOnline: deleteField(),
    total: data.preConfirmTotal ?? data.total,
    subTotal: data.preConfirmSubTotal ?? data.subTotal,
  };

  // Restore original actuals + discrepancy if they were overridden during reject
  if (data.originalActualCash !== undefined) {
    dailyUpdates.actualCash = data.originalActualCash;
    dailyUpdates.actualQris = data.originalActualQris;
    dailyUpdates.actualOnline = data.originalActualOnline;
    dailyUpdates.originalActualCash = deleteField();
    dailyUpdates.originalActualQris = deleteField();
    dailyUpdates.originalActualOnline = deleteField();
  }
  if (data.originalDiscrepancyCash !== undefined) {
    dailyUpdates.discrepancyCash = data.originalDiscrepancyCash;
    dailyUpdates.discrepancyQris = data.originalDiscrepancyQris;
    dailyUpdates.discrepancyOnline = data.originalDiscrepancyOnline;
    dailyUpdates.originalDiscrepancyCash = deleteField();
    dailyUpdates.originalDiscrepancyQris = deleteField();
    dailyUpdates.originalDiscrepancyOnline = deleteField();
  }

  batch.update(dailyRef, dailyUpdates);

  const monthRef = doc(db, getCollectionPath("MonthlyTransaction"), monthId);
  batch.update(monthRef, {
    total: increment(-totalDelta),
    totalCash: increment(-deltaCash),
    totalQris: increment(-deltaQris),
    totalOnline: increment(-deltaOnline),
  });

  const yearRef = doc(db, getCollectionPath("YearlyTransaction"), yearId);
  batch.update(yearRef, {
    total: increment(-totalDelta),
    totalCash: increment(-deltaCash),
    totalQris: increment(-deltaQris),
    totalOnline: increment(-deltaOnline),
  });

  await batch.commit();
}

export async function fetchMonthsWithUnconfirmedDiscrepancies(
  db: Firestore
): Promise<Set<string>> {
  const ref = collection(db, getCollectionPath("DailyTransaction"));
  const snapshot = await getDocs(ref);
  const months = new Set<string>();

  snapshot.forEach((d) => {
    const data = d.data();
    if (data.isDiscrepancyConfirmed === true) return;

    const dCash = data.discrepancyCash ?? 0;
    const dQris = data.discrepancyQris ?? 0;
    const dOnline = data.discrepancyOnline ?? 0;

    if (dCash !== 0 || dQris !== 0 || dOnline !== 0) {
      const [yyyy, mm] = d.id.split("-");
      months.add(`${yyyy}-${mm}`);
    }
  });

  return months;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expenseDateKey(expense: ExpenseData): string {
  const jkt = new Date(
    expense.timestamp.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const y = jkt.getFullYear();
  const m = String(jkt.getMonth() + 1).padStart(2, "0");
  const d = String(jkt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeAccount(source: string): AccountType {
  const s = source.toLowerCase();
  if (s === "cash") return "cash";
  if (s === "qris") return "qris";
  if (s === "online") return "online";
  return "cash";
}

export function formatDayLabel(dateStr: string): string {
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${parseInt(dd)}/${parseInt(mm)}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Row Builder
// ---------------------------------------------------------------------------

export function buildCashflowRows(
  transactions: DailyTransactionData[],
  expenses: ExpenseData[],
  opening: OpeningBalance
): CashflowRow[] {
  const rows: CashflowRow[] = [];

  let cashBal = opening.openingCash;
  let qrisBal = opening.openingQris;
  let onlineBal = opening.openingOnline;

  // Opening Balance
  rows.push({
    date: "",
    rawDate: "",
    description: "Opening Balance",
    cashAmount: 0,
    cashBalance: cashBal,
    qrisAmount: 0,
    qrisBalance: qrisBal,
    onlineAmount: 0,
    onlineBalance: onlineBal,
    rowType: "opening",
  });

  // Group expenses by Jakarta date
  const expByDate: Record<string, ExpenseData[]> = {};
  for (const e of expenses) {
    const key = expenseDateKey(e);
    (expByDate[key] ??= []).push(e);
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  for (const t of transactions) allDates.add(t.date);
  for (const k of Object.keys(expByDate)) allDates.add(k);
  const sorted = Array.from(allDates).sort();

  for (const dateStr of sorted) {
    const txn = transactions.find((t) => t.date === dateStr);
    const dayExp = expByDate[dateStr] ?? [];
    let rowCount = 0;

    if (txn) {
      // Sales — always use system-recorded totals
      const sCash = txn.totalCash ?? 0;
      const sOnline = txn.totalOnline ?? 0;
      const sQris = txn.totalQris ?? 0;

      cashBal += sCash;
      qrisBal += sQris;
      onlineBal += sOnline;

      rows.push({
        date: rowCount === 0 ? formatDayLabel(dateStr) : "",
        rawDate: dateStr,
        description: "Sales",
        cashAmount: sCash,
        cashBalance: cashBal,
        qrisAmount: sQris,
        qrisBalance: qrisBal,
        onlineAmount: sOnline,
        onlineBalance: onlineBal,
        rowType: "sales",
      });
      rowCount++;

      // Discrepancy — read from stored fields
      const dCash = txn.discrepancyCash ?? 0;
      const dQris = txn.discrepancyQris ?? 0;
      const dOnline = txn.discrepancyOnline ?? 0;

      if (dCash !== 0 || dOnline !== 0 || dQris !== 0) {
        cashBal += dCash;
        qrisBal += dQris;
        onlineBal += dOnline;

        rows.push({
          date: rowCount === 0 ? formatDayLabel(dateStr) : "",
          rawDate: dateStr,
          description: "Discrepancy",
          cashAmount: dCash,
          cashBalance: cashBal,
          qrisAmount: dQris,
          qrisBalance: qrisBal,
          onlineAmount: dOnline,
          onlineBalance: onlineBal,
          rowType: "discrepancy",
          isDiscrepancyConfirmed: txn.isDiscrepancyConfirmed,
        });
        rowCount++;
      }

      // Anchor adjustment — per-account, dynamically computed against running balance
      const hasAnchor = txn.anchorCash !== undefined || txn.anchorQris !== undefined || txn.anchorOnline !== undefined;
      if (hasAnchor) {
        const adjCash = txn.anchorCash !== undefined ? txn.anchorCash - cashBal : 0;
        const adjQris = txn.anchorQris !== undefined ? txn.anchorQris - qrisBal : 0;
        const adjOnline = txn.anchorOnline !== undefined ? txn.anchorOnline - onlineBal : 0;

        if (txn.anchorCash !== undefined) cashBal = txn.anchorCash;
        if (txn.anchorQris !== undefined) qrisBal = txn.anchorQris;
        if (txn.anchorOnline !== undefined) onlineBal = txn.anchorOnline;

        rows.push({
          date: rowCount === 0 ? formatDayLabel(dateStr) : "",
          rawDate: dateStr,
          description: "Adjustment",
          cashAmount: adjCash,
          cashBalance: cashBal,
          qrisAmount: adjQris,
          qrisBalance: qrisBal,
          onlineAmount: adjOnline,
          onlineBalance: onlineBal,
          rowType: "adjustment",
        });
        rowCount++;
      }
    }

    // Individual expense rows
    for (const exp of dayExp) {
      const acct = normalizeAccount(exp.sourceAccount);
      const neg = -exp.amount;

      if (acct === "cash") cashBal += neg;
      if (acct === "qris") qrisBal += neg;
      if (acct === "online") onlineBal += neg;

      rows.push({
        date: rowCount === 0 ? formatDayLabel(dateStr) : "",
        rawDate: dateStr,
        description: exp.category,
        cashAmount: acct === "cash" ? neg : 0,
        cashBalance: cashBal,
        qrisAmount: acct === "qris" ? neg : 0,
        qrisBalance: qrisBal,
        onlineAmount: acct === "online" ? neg : 0,
        onlineBalance: onlineBal,
        rowType: "expense",
        sourceAccount: acct,
        expenseTimestamp: exp.timestamp,
        addedFromDashboardWeb: exp.addedFromDashboardWeb,
      });
      rowCount++;
    }
  }

  // Closing Balance
  rows.push({
    date: "",
    rawDate: "",
    description: "Closing Balance",
    cashAmount: 0,
    cashBalance: cashBal,
    qrisAmount: 0,
    qrisBalance: qrisBal,
    onlineAmount: 0,
    onlineBalance: onlineBal,
    rowType: "closing",
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Account Filter
// ---------------------------------------------------------------------------

export function filterRowsByAccount(
  rows: CashflowRow[],
  account: AccountType
): CashflowRow[] {
  return rows.filter((r) => {
    if (r.rowType === "opening" || r.rowType === "closing" || r.rowType === "sales" || r.rowType === "adjustment")
      return true;
    if (r.rowType === "discrepancy") {
      if (account === "cash") return r.cashAmount !== 0;
      if (account === "qris") return r.qrisAmount !== 0;
      if (account === "online") return r.onlineAmount !== 0;
    }
    if (r.rowType === "expense") return r.sourceAccount === account;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Currency Formatting
// ---------------------------------------------------------------------------

export function fmtAmount(n: number): string {
  if (n === 0) return "0";
  return new Intl.NumberFormat("id-ID").format(n);
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

export function generateCashflowPDF(
  rows: CashflowRow[],
  monthLabel: string
): void {
  const cleanLabel = monthLabel.replace(" (ongoing)", "");
  const pdf = new jsPDF({ orientation: "landscape" });

  // Title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Cashflow Statement`, 14, 16);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text(cleanLabel, 14, 23);
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`,
    14,
    29
  );
  pdf.setTextColor(0, 0, 0);

  const head = [
    [
      { content: "Date", rowSpan: 2 },
      { content: "Description", rowSpan: 2 },
      { content: "Cash", colSpan: 2 },
      { content: "QRIS", colSpan: 2 },
      { content: "Online", colSpan: 2 },
    ],
    ["Amount", "Balance", "Amount", "Balance", "Amount", "Balance"],
  ];

  const fmtPdfAmt = (n: number) => {
    if (n === 0) return "";
    const prefix = n > 0 ? "+" : "";
    return `${prefix}${fmtAmount(n)}`;
  };

  const body = rows.map((r) => {
    const isHighlight = r.rowType === "opening" || r.rowType === "closing";
    return [
      r.date,
      r.description,
      isHighlight ? "" : fmtPdfAmt(r.cashAmount),
      fmtAmount(r.cashBalance),
      isHighlight ? "" : fmtPdfAmt(r.qrisAmount),
      fmtAmount(r.qrisBalance),
      isHighlight ? "" : fmtPdfAmt(r.onlineAmount),
      fmtAmount(r.onlineBalance),
    ];
  });

  autoTable(pdf, {
    head,
    body,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [30, 30, 30], lineColor: [209, 213, 219], lineWidth: 0.3 },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [209, 213, 219],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      lineColor: [55, 65, 81],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 48 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row) return;

      if (row.rowType === "opening") {
        data.cell.styles.fillColor = [248, 250, 252];
        data.cell.styles.fontStyle = "bold";
      } else if (row.rowType === "adjustment") {
        data.cell.styles.fillColor = [239, 246, 255]; // blue-50
      } else if (row.rowType === "closing") {
        data.cell.styles.fillColor = [203, 213, 225]; // slate-300
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.lineWidth = 0.5;
        data.cell.styles.lineColor = [100, 116, 139];
        data.cell.styles.fontSize = 9;
      }

      // Semantic amount colors
      if (data.column.index >= 2 && data.column.index % 2 === 0) {
        const val =
          data.column.index === 2 ? row.cashAmount :
          data.column.index === 4 ? row.qrisAmount :
          row.onlineAmount;
        if (val < 0) data.cell.styles.textColor = [239, 68, 68];
        else if (val > 0) data.cell.styles.textColor = [16, 185, 129];
        else data.cell.styles.textColor = [148, 163, 184];
      }

      // Balance columns — lighter for normal rows, bold for closing
      if (data.column.index >= 2 && data.column.index % 2 === 1) {
        const bal =
          data.column.index === 3 ? row.cashBalance :
          data.column.index === 5 ? row.qrisBalance :
          row.onlineBalance;
        if (row.rowType === "closing") {
          data.cell.styles.textColor = bal < 0 ? [239, 68, 68] : [30, 30, 30];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = bal < 0 ? [248, 113, 113] : [148, 163, 184]; // lighter
          data.cell.styles.fontSize = 7;
        }
      }

      // Thick left border on account group separators (cols 2, 4, 6)
      if (data.column.index === 2 || data.column.index === 4 || data.column.index === 6) {
        data.cell.styles.lineWidth = { top: 0.3, bottom: 0.3, left: 1, right: 0.3 };
      }
    },
  });

  const safeName = cleanLabel.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  pdf.save(`cashflow-${safeName}.pdf`);
}
