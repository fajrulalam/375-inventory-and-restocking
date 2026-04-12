"use client";

import { useEffect, useState, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { firebaseConfig } from "@/config/firebase";
import { useTestingMode } from "@/contexts/TestingModeContext";
import {
  AccountType,
  CashflowRow,
  OpeningBalance,
  fetchAvailableMonths,
  fetchDailyTransactionsForMonth,
  fetchExpensesForMonth,
  fetchOpeningBalance,
  saveOpeningBalance,
  addExpense,
  buildCashflowRows,
  filterRowsByAccount,
  formatMonthLabel,
  fmtAmount,
  generateCashflowPDF,
  confirmDiscrepancy,
  rejectDiscrepancy,
  undoDiscrepancyConfirmation,
  anchorBalance,
  undoAnchor,
  DailyTransactionData,
  formatDayLabel,
} from "@/utils/cashflowUtils";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Category config (cards only — headers use neutral charcoal)
// ---------------------------------------------------------------------------
const CATEGORY = {
  cash:   { label: "Cash",   iconColor: "text-slate-500",  cardBg: "bg-slate-700",  cardBorder: "border-slate-700",  cardRing: "ring-slate-400" },
  qris:   { label: "QRIS",   iconColor: "text-blue-500",   cardBg: "bg-blue-700",   cardBorder: "border-blue-700",   cardRing: "ring-blue-400" },
  online: { label: "Online", iconColor: "text-purple-500", cardBg: "bg-purple-700", cardBorder: "border-purple-700", cardRing: "ring-purple-400" },
} as const;

// Monospace utility
const MONO = "font-[var(--font-geist-mono)]";

// ---------------------------------------------------------------------------
// Small header icons (wallet, QR, globe) — 14px inline
// ---------------------------------------------------------------------------
function WalletMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1 opacity-50">
      <path d="M2 5a2 2 0 012-2h8a2 2 0 012 2v1H2V5zm0 3v3a2 2 0 002 2h8a2 2 0 002-2V8H2zm9 1.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
    </svg>
  );
}
function QrMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1 opacity-50">
      <path d="M2 3.5A1.5 1.5 0 013.5 2h2A1.5 1.5 0 017 3.5v2A1.5 1.5 0 015.5 7h-2A1.5 1.5 0 012 5.5v-2zm1.5-.5a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-2a.5.5 0 00-.5-.5h-2zM2 10.5A1.5 1.5 0 013.5 9h2A1.5 1.5 0 017 10.5v2A1.5 1.5 0 015.5 14h-2A1.5 1.5 0 012 12.5v-2zm1.5-.5a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-2a.5.5 0 00-.5-.5h-2zM9 3.5A1.5 1.5 0 0110.5 2h2A1.5 1.5 0 0114 3.5v2A1.5 1.5 0 0112.5 7h-2A1.5 1.5 0 019 5.5v-2zm1.5-.5a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-2a.5.5 0 00-.5-.5h-2zM9 10a.75.75 0 011.5 0v1h1a.75.75 0 010 1.5h-1v1.5a.75.75 0 01-1.5 0V12.5h-.5a.75.75 0 010-1.5h.5V10zm2.5.75a.75.75 0 01.75-.75h1a.75.75 0 010 1.5h-1a.75.75 0 01-.75-.75zm.75 1.75a.75.75 0 000 1.5h1a.75.75 0 000-1.5h-1z" />
    </svg>
  );
}
function BikeMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1 opacity-50">
      <path d="M3.5 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0-1.5a1 1 0 110-2 1 1 0 010 2zm9 1.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0-1.5a1 1 0 110-2 1 1 0 010 2zM6 7l1.5-3H10l1 2H8.5L8 7H6zm-1 1h4l.5 1H5.5L5 8z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card icons (larger, for account filter cards)
// ---------------------------------------------------------------------------
function CashIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-6 h-6 ${active ? "text-white" : CATEGORY.cash.iconColor}`}>
      <path fillRule="evenodd" d="M1 4a1 1 0 011-1h16a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm12 4a3 3 0 11-6 0 3 3 0 016 0zM4 9a1 1 0 100-2 1 1 0 000 2zm13-1a1 1 0 11-2 0 1 1 0 012 0zM1.75 14.5a.75.75 0 000 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 00-1.5 0v.784a.272.272 0 01-.35.25A49.043 49.043 0 001.75 14.5z" clipRule="evenodd" />
    </svg>
  );
}
function QrisIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-6 h-6 ${active ? "text-white" : CATEGORY.qris.iconColor}`}>
      <path fillRule="evenodd" d="M3.75 2A1.75 1.75 0 002 3.75v3.5C2 8.216 2.784 9 3.75 9h3.5A1.75 1.75 0 009 7.25v-3.5A1.75 1.75 0 007.25 2h-3.5zM3.5 3.75a.25.25 0 01.25-.25h3.5a.25.25 0 01.25.25v3.5a.25.25 0 01-.25.25h-3.5a.25.25 0 01-.25-.25v-3.5zM3.75 11A1.75 1.75 0 002 12.75v3.5c0 .966.784 1.75 1.75 1.75h3.5A1.75 1.75 0 009 16.25v-3.5A1.75 1.75 0 007.25 11h-3.5zm-.25 1.75a.25.25 0 01.25-.25h3.5a.25.25 0 01.25.25v3.5a.25.25 0 01-.25.25h-3.5a.25.25 0 01-.25-.25v-3.5zM12.75 2A1.75 1.75 0 0011 3.75v3.5c0 .966.784 1.75 1.75 1.75h3.5A1.75 1.75 0 0018 7.25v-3.5A1.75 1.75 0 0016.25 2h-3.5zm-.25 1.75a.25.25 0 01.25-.25h3.5a.25.25 0 01.25.25v3.5a.25.25 0 01-.25.25h-3.5a.25.25 0 01-.25-.25v-3.5zM11 12.75a.75.75 0 011.5 0v1.5h1.5a.75.75 0 010 1.5H13v2.5a.75.75 0 01-1.5 0v-2.5h-1a.75.75 0 010-1.5h1v-1.5zm3.5 1a.75.75 0 01.75-.75h2a.75.75 0 010 1.5h-2a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h2a.75.75 0 000-1.5h-2z" clipRule="evenodd" />
    </svg>
  );
}
function OnlineIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${active ? "text-white" : CATEGORY.online.iconColor}`}>
      <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 116 0h3a3 3 0 116 0h.375c1.035 0 1.875-.84 1.875-1.875V15h-1.5zM8.25 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM19.5 19.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
      <path d="M19.125 4.5a1.875 1.875 0 00-1.875 1.875V8.25h3.75V6.375A1.875 1.875 0 0019.125 4.5zm1.875 5.25h-3.75v4.5h5.625c.621 0 1.125-.504 1.125-1.125V11.25a2.625 2.625 0 00-2.625-2.625h-.375z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// UI icons
// ---------------------------------------------------------------------------
function ChevronDownIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-5 h-5"}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>;
}
function DownloadIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>;
}
function PencilIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>;
}
function HamburgerIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>;
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function OpeningBalanceModal({ balance, onSave, onClose }: { balance: OpeningBalance; onSave: (b: OpeningBalance) => void; onClose: () => void }) {
  const [cash, setCash] = useState(String(balance.openingCash));
  const [qris, setQris] = useState(String(balance.openingQris));
  const [online, setOnline] = useState(String(balance.openingOnline));
  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-5">Edit Opening Balance</h3>
        <div className="space-y-4">
          {[{ l: "Cash", v: cash, s: setCash }, { l: "QRIS", v: qris, s: setQris }, { l: "Online", v: online, s: setOnline }].map(({ l, v, s }) => (
            <div key={l}><label className="block text-sm font-medium text-gray-500 mb-1.5">{l}</label><input type="number" value={v} onChange={(e) => s(e.target.value)} className={inputClass} /></div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={() => onSave({ openingCash: parseInt(cash) || 0, openingQris: parseInt(qris) || 0, openingOnline: parseInt(online) || 0 })} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

function AddExpenseModal({ onSave, onClose }: { onSave: (d: { amount: number; category: string; sourceAccount: string }) => void; onClose: () => void }) {
  const [rawAmount, setRawAmount] = useState("");
  const [category, setCategory] = useState("");
  const [sourceAccount, setSourceAccount] = useState("Cash");
  const numericAmount = parseInt(rawAmount.replace(/\D/g, "")) || 0;
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) { setRawAmount(""); return; }
    setRawAmount(new Intl.NumberFormat("id-ID").format(parseInt(digits)));
  };
  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-5">Add Expense</h3>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-500 mb-1.5">Description</label><input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Token Listrik" className={inputClass} /></div>
          <div><label className="block text-sm font-medium text-gray-500 mb-1.5">Amount</label><input type="text" inputMode="numeric" value={rawAmount} onChange={handleAmountChange} placeholder="50.000" className={inputClass} /></div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Account</label>
            <div className="flex gap-2">
              {["Cash", "QRIS", "Online"].map((k) => (
                <button key={k} onClick={() => setSourceAccount(k)} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${sourceAccount === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{k}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={() => { if (numericAmount > 0 && category.trim()) onSave({ amount: numericAmount, category: category.trim(), sourceAccount }); }} disabled={numericAmount <= 0 || !category.trim()} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40">Add Expense</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discrepancy Modals
// ---------------------------------------------------------------------------
interface DiscrepancyInfo {
  dateStr: string;
  dateFmt: string;
  dCash: number;
  dQris: number;
  dOnline: number;
  actualCash: number;
  actualQris: number;
  actualOnline: number;
  totalCash: number;
  totalQris: number;
  totalOnline: number;
}

function ConfirmDiscrepancyModal({ info, onConfirm, onClose, loading }: { info: DiscrepancyInfo; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  const totalDelta = info.dCash + info.dQris + info.dOnline;
  const renderDelta = (v: number) => {
    if (v === 0) return <span className="text-gray-400">0</span>;
    const pos = v > 0;
    return <span className={`${MONO} font-semibold ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(v)}</span>;
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Discrepancy</h3>
        <p className="text-sm text-gray-500 mb-5">Are you sure you want to confirm the discrepancy for <span className="font-semibold text-gray-700">{info.dateFmt}</span>? This will adjust the daily total and update monthly/yearly records.</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Cash</span>{renderDelta(info.dCash)}</div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">QRIS</span>{renderDelta(info.dQris)}</div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Online</span>{renderDelta(info.dOnline)}</div>
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold"><span className="text-gray-700">Net Impact</span>{renderDelta(totalDelta)}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40">{loading ? "Confirming..." : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

function RejectDiscrepancyModal({ info, onReject, onClose, loading }: { info: DiscrepancyInfo; onReject: (actuals: { cash: number; qris: number; online: number }) => void; onClose: () => void; loading: boolean }) {
  const fmtInput = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const parseInput = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;
  const [cash, setCash] = useState(fmtInput(info.actualCash));
  const [qris, setQris] = useState(fmtInput(info.actualQris));
  const [online, setOnline] = useState(fmtInput(info.actualOnline));
  const handleChange = (raw: string, setter: (v: string) => void) => {
    const num = parseInput(raw);
    setter(num === 0 && raw !== "0" && raw !== "" ? "" : fmtInput(num));
  };
  const parsedCash = parseInput(cash);
  const parsedQris = parseInput(qris);
  const parsedOnline = parseInput(online);
  const newDCash = parsedCash - info.totalCash;
  const newDQris = parsedQris - info.totalQris;
  const newDOnline = parsedOnline - info.totalOnline;

  const renderDelta = (v: number) => {
    if (v === 0) return <span className="text-gray-400">0</span>;
    const pos = v > 0;
    return <span className={`${MONO} font-semibold ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(v)}</span>;
  };
  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Override Actual Values</h3>
        <p className="text-sm text-gray-500 mb-5">You are overriding the cashier&apos;s count for <span className="font-semibold text-gray-700">{info.dateFmt}</span>. The new values will be used to adjust records.</p>
        <div className="space-y-4 mb-5">
          {[{ l: "Actual Cash", v: cash, s: setCash }, { l: "Actual QRIS", v: qris, s: setQris }, { l: "Actual Online", v: online, s: setOnline }].map(({ l, v, s }) => (
            <div key={l}><label className="block text-sm font-medium text-gray-500 mb-1.5">{l}</label><input type="text" inputMode="numeric" value={v} onChange={(e) => handleChange(e.target.value, s)} className={inputClass} /></div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">New Discrepancy Preview</p>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Cash</span>{renderDelta(newDCash)}</div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">QRIS</span>{renderDelta(newDQris)}</div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Online</span>{renderDelta(newDOnline)}</div>
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold"><span className="text-gray-700">Net Impact</span>{renderDelta(newDCash + newDQris + newDOnline)}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">Cancel</button>
          <button onClick={() => onReject({ cash: parsedCash, qris: parsedQris, online: parsedOnline })} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-40">{loading ? "Saving..." : "Confirm Changes"}</button>
        </div>
      </div>
    </div>
  );
}

function AnchorBalanceModal({ txnData, onAnchor, onClose, loading }: { txnData: DailyTransactionData[]; onAnchor: (dateStr: string, anchors: { cash?: number; qris?: number; online?: number }) => void; onClose: () => void; loading: boolean }) {
  const fmtInput = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const parseInput = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;
  const dates = txnData.map((t) => t.date);
  const [selectedDate, setSelectedDate] = useState(dates[dates.length - 1] ?? "");
  const txn = txnData.find((t) => t.date === selectedDate);

  const [cashEnabled, setCashEnabled] = useState(true);
  const [qrisEnabled, setQrisEnabled] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [cash, setCash] = useState(fmtInput(txn?.closingCash ?? 0));
  const [qris, setQris] = useState(fmtInput(txn?.closingQris ?? 0));
  const [online, setOnline] = useState(fmtInput(txn?.closingOnline ?? 0));

  const handleDateChange = (d: string) => {
    setSelectedDate(d);
    const t = txnData.find((t) => t.date === d);
    if (t) {
      setCash(fmtInput(t.closingCash));
      setQris(fmtInput(t.closingQris));
      setOnline(fmtInput(t.closingOnline));
    }
  };
  const handleChange = (raw: string, setter: (v: string) => void) => {
    const num = parseInput(raw);
    setter(num === 0 && raw !== "0" && raw !== "" ? "" : fmtInput(num));
  };

  const curCash = txn?.closingCash ?? 0;
  const curQris = txn?.closingQris ?? 0;
  const curOnline = txn?.closingOnline ?? 0;
  const parsedCash = parseInput(cash);
  const parsedQris = parseInput(qris);
  const parsedOnline = parseInput(online);
  const adjCash = cashEnabled ? parsedCash - curCash : 0;
  const adjQris = qrisEnabled ? parsedQris - curQris : 0;
  const adjOnline = onlineEnabled ? parsedOnline - curOnline : 0;
  const anyEnabled = cashEnabled || qrisEnabled || onlineEnabled;

  const renderDelta = (v: number) => {
    if (v === 0) return <span className="text-gray-400">0</span>;
    const pos = v > 0;
    return <span className={`${MONO} font-semibold ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(v)}</span>;
  };
  const adjLabel = (v: number) => {
    if (v === 0) return null;
    return <span className={`text-[10px] font-medium ml-1.5 ${v > 0 ? "text-emerald-500" : "text-red-400"}`}>{v > 0 ? "Earning" : "Expense"}</span>;
  };
  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  const accounts: { key: "cash" | "qris" | "online"; label: string; enabled: boolean; setEnabled: (v: boolean) => void; value: string; setValue: (v: string) => void; current: number }[] = [
    { key: "cash", label: "Cash", enabled: cashEnabled, setEnabled: setCashEnabled, value: cash, setValue: setCash, current: curCash },
    { key: "qris", label: "QRIS", enabled: qrisEnabled, setEnabled: setQrisEnabled, value: qris, setValue: setQris, current: curQris },
    { key: "online", label: "Online", enabled: onlineEnabled, setEnabled: setOnlineEnabled, value: online, setValue: setOnline, current: curOnline },
  ];

  const handleSubmit = () => {
    const anchors: { cash?: number; qris?: number; online?: number } = {};
    if (cashEnabled) anchors.cash = parsedCash;
    if (qrisEnabled) anchors.qris = parsedQris;
    if (onlineEnabled) anchors.online = parsedOnline;
    onAnchor(selectedDate, anchors);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Anchor Balance</h3>
        <p className="text-sm text-gray-500 mb-5">Set the real physical balance. The system will adjust to match your count and correct any drift.</p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-500 mb-1.5">Date</label>
          <div className="relative">
            <select value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} className="appearance-none w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
              {dates.map((d) => <option key={d} value={d}>{formatDayLabel(d)}</option>)}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-4 mb-5">
          {accounts.map(({ key, label, enabled, setEnabled, value, setValue, current }) => (
            <div key={key} className={`rounded-xl border p-4 transition-all ${enabled ? "border-indigo-200 bg-indigo-50/30" : "border-gray-100 bg-gray-50/50 opacity-60"}`}>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setEnabled(!enabled)} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${enabled ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white"}`}>
                    {enabled && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                </button>
                <span className={`text-[11px] ${MONO} text-gray-400`}>Current: {fmtAmount(current)}</span>
              </div>
              {enabled && <input type="text" inputMode="numeric" value={value} onChange={(e) => handleChange(e.target.value, setValue)} className={inputClass} />}
            </div>
          ))}
        </div>

        {anyEnabled && (
          <div className="bg-blue-50/60 rounded-xl p-4 mb-6 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adjustment Preview</p>
            {cashEnabled && <div className="flex justify-between items-center text-sm"><span className="text-gray-500">Cash{adjLabel(adjCash)}</span>{renderDelta(adjCash)}</div>}
            {qrisEnabled && <div className="flex justify-between items-center text-sm"><span className="text-gray-500">QRIS{adjLabel(adjQris)}</span>{renderDelta(adjQris)}</div>}
            {onlineEnabled && <div className="flex justify-between items-center text-sm"><span className="text-gray-500">Online{adjLabel(adjOnline)}</span>{renderDelta(adjOnline)}</div>}
            <div className="border-t border-blue-200/60 pt-2 flex justify-between text-sm font-bold"><span className="text-gray-700">Net Adjustment</span>{renderDelta(adjCash + adjQris + adjOnline)}</div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !anyEnabled} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40">{loading ? "Anchoring..." : "Anchor Balance"}</button>
        </div>
      </div>
    </div>
  );
}

function UndoDiscrepancyModal({ dateFmt, onUndo, onClose, loading }: { dateFmt: string; onUndo: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-7">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Undo Discrepancy Confirmation</h3>
        <p className="text-sm text-gray-500 mb-6">Undo the confirmed discrepancy for <span className="font-semibold text-gray-700">{dateFmt}</span>? This will revert the daily total and monthly/yearly adjustments.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">Cancel</button>
          <button onClick={onUndo} disabled={loading} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40">{loading ? "Reverting..." : "Undo"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Card
// ---------------------------------------------------------------------------
function AccountCard({ label, balance, active, cat, icon, onClick }: { label: string; balance: number; active: boolean; cat: (typeof CATEGORY)[AccountType]; icon: React.ReactNode; onClick: () => void }) {
  const neg = balance < 0;
  return (
    <button onClick={onClick} className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl border-2 transition-all duration-200 min-w-[180px] ${active ? `${cat.cardBg} ${cat.cardBorder} ${cat.cardRing} shadow-lg ring-2 ring-offset-2` : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"}`}>
      {icon}
      <div className="text-left">
        <p className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-white/70" : "text-gray-400"}`}>{label}</p>
        <p className={`text-lg font-bold tracking-tight ${MONO} ${active ? (neg ? "text-red-300" : "text-white") : (neg ? "text-red-500" : "text-gray-900")}`}>Rp {fmtAmount(balance)}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
function ExpenseTooltip({ row }: { row: CashflowRow }) {
  if (!row.expenseTimestamp) return null;
  const ts = row.expenseTimestamp.toLocaleString("en-US", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
      <p>{ts}</p>
      <p className="text-gray-400 mt-0.5">{row.addedFromDashboardWeb ? "Added from Dashboard" : "Added from POS"}</p>
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
    </div>
  );
}

function DiscrepancyTooltip({ row, onConfirm, onReject, onUndo }: { row: CashflowRow; onConfirm: () => void; onReject: () => void; onUndo: () => void }) {
  const confirmed = row.isDiscrepancyConfirmed;
  const renderVal = (v: number) => {
    if (v === 0) return <span className={`${MONO} font-medium text-gray-400`}>0</span>;
    const pos = v > 0;
    return <span className={`${MONO} font-medium ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(v)}</span>;
  };
  return (
    <div className="absolute bottom-full left-0 pb-1 z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white/95 backdrop-blur-sm text-gray-700 text-xs rounded-xl shadow-lg border border-gray-200/80 p-3 min-w-[200px]">
        {!confirmed ? (
          <>
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between gap-6"><span className="text-gray-400">Cash</span>{renderVal(row.cashAmount)}</div>
              <div className="flex justify-between gap-6"><span className="text-gray-400">QRIS</span>{renderVal(row.qrisAmount)}</div>
              <div className="flex justify-between gap-6"><span className="text-gray-400">Online</span>{renderVal(row.onlineAmount)}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={onConfirm} className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-500/80 hover:bg-emerald-500 rounded-lg transition-colors text-center">Confirm</button>
              <button onClick={onReject} className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-amber-500/80 hover:bg-amber-500 rounded-lg transition-colors text-center">Override</button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-emerald-500 font-medium text-[11px]">Confirmed</span>
            <button onClick={onUndo} className="px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">Undo</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdjustmentTooltip({ row, onUndo }: { row: CashflowRow; onUndo: () => void }) {
  const renderVal = (label: string, v: number) => {
    if (v === 0) return null;
    const pos = v > 0;
    return (
      <div className="flex justify-between gap-6">
        <span className="text-gray-400">{label}</span>
        <span className={`${MONO} font-medium ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(v)}</span>
      </div>
    );
  };
  return (
    <div className="absolute bottom-full left-0 pb-1 z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white/95 backdrop-blur-sm text-gray-700 text-xs rounded-xl shadow-lg border border-gray-200/80 p-3 min-w-[200px]">
        <div className="space-y-1.5 mb-3">
          {renderVal("Cash", row.cashAmount)}
          {renderVal("QRIS", row.qrisAmount)}
          {renderVal("Online", row.onlineAmount)}
          {row.cashAmount === 0 && row.qrisAmount === 0 && row.onlineAmount === 0 && (
            <span className="text-gray-400">No change</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-indigo-500 font-medium text-[11px]">Anchored</span>
          <button onClick={onUndo} className="px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">Undo</button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return <div className="animate-pulse space-y-3 p-8">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CashflowPage() {
  const { isTestingMode, toggleTestingMode } = useTestingMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [allRows, setAllRows] = useState<CashflowRow[]>([]);
  const [txnData, setTxnData] = useState<DailyTransactionData[]>([]);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalance>({ openingCash: 0, openingQris: 0, openingOnline: 0 });
  const [activeAccount, setActiveAccount] = useState<AccountType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [hoveredExpenseIdx, setHoveredExpenseIdx] = useState<number | null>(null);
  const [hoveredDiscIdx, setHoveredDiscIdx] = useState<number | null>(null);
  const [hoveredAdjIdx, setHoveredAdjIdx] = useState<number | null>(null);
  const [discrepancyModal, setDiscrepancyModal] = useState<{ type: "confirm" | "reject" | "undo"; info: DiscrepancyInfo } | null>(null);
  const [discrepancyLoading, setDiscrepancyLoading] = useState(false);

  const isCurrentMonth = (() => {
    if (!selectedMonth) return false;
    const now = new Date();
    const jkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return selectedMonth === `${jkt.getFullYear()}-${String(jkt.getMonth() + 1).padStart(2, "0")}`;
  })();

  useEffect(() => {
    let cancelled = false;
    setIsLoadingMonths(true);
    fetchAvailableMonths(db).then((m) => {
      if (cancelled) return;
      setMonths(m);
      if (m.length > 0 && !selectedMonth) setSelectedMonth(m[0]);
      setIsLoadingMonths(false);
    });
    return () => { cancelled = true; };
  }, [isTestingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!selectedMonth) return;
    setIsLoading(true);
    try {
      const [txns, expenses, opening] = await Promise.all([fetchDailyTransactionsForMonth(db, selectedMonth), fetchExpensesForMonth(db, selectedMonth), fetchOpeningBalance(db, selectedMonth)]);
      setOpeningBalance(opening);
      setTxnData(txns);
      setAllRows(buildCashflowRows(txns, expenses, opening));
    } catch (err) { console.error("Failed to load cashflow data:", err); }
    finally { setIsLoading(false); }
  }, [selectedMonth]);

  useEffect(() => { loadData(); }, [loadData, isTestingMode]);

  const displayRows = activeAccount ? filterRowsByAccount(allRows, activeAccount) : allRows;
  const closingRow = allRows.find((r) => r.rowType === "closing");
  const closingCash = closingRow?.cashBalance ?? 0;
  const closingQris = closingRow?.qrisBalance ?? 0;
  const closingOnline = closingRow?.onlineBalance ?? 0;

  const handleAccountToggle = (acct: AccountType) => setActiveAccount((p) => (p === acct ? null : acct));
  const handleSaveBalance = async (b: OpeningBalance) => { setShowBalanceModal(false); setOpeningBalance(b); await saveOpeningBalance(db, selectedMonth, b); loadData(); };
  const handleAddExpense = async (d: { amount: number; category: string; sourceAccount: string }) => { setShowExpenseModal(false); await addExpense(db, d); loadData(); };
  const handleDownloadPDF = () => { if (allRows.length > 0) generateCashflowPDF(allRows, formatMonthLabel(selectedMonth)); };

  const openDiscrepancyModal = (row: CashflowRow, type: "confirm" | "reject" | "undo") => {
    const txn = txnData.find((t) => t.date === row.rawDate);
    if (!txn) return;
    const tCash = txn.totalCash ?? 0;
    const tQris = txn.totalQris ?? 0;
    const tOnline = txn.totalOnline ?? 0;
    const info: DiscrepancyInfo = {
      dateStr: row.rawDate,
      dateFmt: formatDayLabel(row.rawDate),
      dCash: txn.discrepancyCash ?? 0,
      dQris: txn.discrepancyQris ?? 0,
      dOnline: txn.discrepancyOnline ?? 0,
      actualCash: txn.actualCash ?? tCash,
      actualQris: txn.actualQris ?? tQris,
      actualOnline: txn.actualOnline ?? tOnline,
      totalCash: tCash,
      totalQris: tQris,
      totalOnline: tOnline,
    };
    setDiscrepancyModal({ type, info });
  };

  const handleConfirmDiscrepancy = async () => {
    if (!discrepancyModal) return;
    setDiscrepancyLoading(true);
    try {
      await confirmDiscrepancy(db, discrepancyModal.info.dateStr);
      setDiscrepancyModal(null);
      await loadData();
    } catch (err) { console.error("Failed to confirm discrepancy:", err); }
    finally { setDiscrepancyLoading(false); }
  };

  const handleRejectDiscrepancy = async (actuals: { cash: number; qris: number; online: number }) => {
    if (!discrepancyModal) return;
    setDiscrepancyLoading(true);
    try {
      await rejectDiscrepancy(db, discrepancyModal.info.dateStr, actuals);
      setDiscrepancyModal(null);
      await loadData();
    } catch (err) { console.error("Failed to reject discrepancy:", err); }
    finally { setDiscrepancyLoading(false); }
  };

  const [anchorLoading, setAnchorLoading] = useState(false);
  const handleAnchorBalance = async (dateStr: string, anchors: { cash?: number; qris?: number; online?: number }) => {
    setAnchorLoading(true);
    try {
      await anchorBalance(db, dateStr, anchors);
      setShowAnchorModal(false);
      await loadData();
    } catch (err) { console.error("Failed to anchor balance:", err); }
    finally { setAnchorLoading(false); }
  };

  const handleUndoAnchor = async (dateStr: string) => {
    try {
      await undoAnchor(db, dateStr);
      await loadData();
    } catch (err) { console.error("Failed to undo anchor:", err); }
  };

  const handleUndoDiscrepancy = async () => {
    if (!discrepancyModal) return;
    setDiscrepancyLoading(true);
    try {
      await undoDiscrepancyConfirmation(db, discrepancyModal.info.dateStr);
      setDiscrepancyModal(null);
      await loadData();
    } catch (err) { console.error("Failed to undo discrepancy:", err); }
    finally { setDiscrepancyLoading(false); }
  };

  const monthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : "";
  const showCash = !activeAccount || activeAccount === "cash";
  const showQris = !activeAccount || activeAccount === "qris";
  const showOnline = !activeAccount || activeAccount === "online";
  const colCount = 2 + (showCash ? 2 : 0) + (showQris ? 2 : 0) + (showOnline ? 2 : 0);

  // Rendering helpers — Amount: standard weight, semantic color, no Rp. Balance: lighter, smaller.
  const renderAmt = (amount: number, isHL: boolean) => {
    if (isHL) return null;
    if (amount === 0) return <span className="text-slate-300">—</span>;
    const pos = amount > 0;
    return <span className={`${MONO} font-medium ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "+" : ""}{fmtAmount(amount)}</span>;
  };

  const renderBal = (balance: number, isClosingRow: boolean) => {
    if (isClosingRow) {
      return <span className={`${MONO} font-bold ${balance < 0 ? "text-red-600" : "text-gray-900"}`}>{fmtAmount(balance)}</span>;
    }
    return <span className={`${MONO} text-xs ${balance < 0 ? "text-red-400" : "text-gray-400"}`}>{fmtAmount(balance)}</span>;
  };

  // Header icon map
  const headerIcon: Record<string, React.ReactNode> = { cash: <WalletMini />, qris: <QrMini />, online: <BikeMini /> };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all duration-150"><HamburgerIcon /></button>
            <Image src="/assets/375_logo.png" alt="375 Logo" width={32} height={32} />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Cashflow Statement</h1>
              <p className="text-sm text-gray-400">{monthLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTestingMode} className={`p-2.5 rounded-xl border transition-all duration-200 ${isTestingMode ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 ring-offset-1 shadow-sm" : "text-gray-400 bg-white border-gray-100 hover:text-gray-600 hover:border-gray-200 shadow-sm"}`} title={isTestingMode ? "Testing mode ON" : "Testing mode OFF"}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.5 3.528v4.644c0 .729-.29 1.428-.805 1.944l-1.217 1.216a8.75 8.75 0 013.55.621l.502.164a12.826 12.826 0 003.78.596 8.65 8.65 0 01-6.373-.1l-.331-.125a6.75 6.75 0 00-2.94-.423L2.785 14.07c-.163.163-.163.427 0 .59l2.424 2.424c.164.164.428.164.591 0l3.072-3.072a2.75 2.75 0 011.944-.806h4.644A2.5 2.5 0 0018 10.75V9.5a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586L8.5 3.528z" clipRule="evenodd" /></svg>
            </button>
            {txnData.length > 0 && (
              <button onClick={() => setShowAnchorModal(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.5a4.002 4.002 0 0 1 3.244 3.673l.007.127H15a.75.75 0 0 1 0 1.5h-.999a4.002 4.002 0 0 1-3.251 3.2V15.5A2.5 2.5 0 0 0 13.25 18a.75.75 0 0 1 0 1.5A4 4 0 0 1 9.25 15.5v-3.75a4.002 4.002 0 0 1-3.251-3.2H5a.75.75 0 0 1 0-1.5h.999a4.002 4.002 0 0 1 3.251-3.8v-.5A.75.75 0 0 1 10 2Zm-2.5 5.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" clipRule="evenodd" /></svg>
                Anchor balance
              </button>
            )}
            {isCurrentMonth && (
              <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                Add expense
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={allRows.length === 0} className="p-2.5 rounded-xl border border-gray-100 bg-white text-gray-400 shadow-sm hover:text-gray-600 hover:border-gray-200 transition-all duration-200 disabled:opacity-40" title="Download PDF"><DownloadIcon /></button>
          </div>
        </header>

        {/* Month Selector */}
        <div className="mb-6">
          <div className="relative inline-block">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} disabled={isLoadingMonths} className="appearance-none pl-5 pr-11 py-3 rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer disabled:opacity-50">
              {months.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
            </select>
            <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Account Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-8">
          <AccountCard label="Cash"   balance={closingCash}   active={activeAccount === "cash"}   cat={CATEGORY.cash}   icon={<CashIcon active={activeAccount === "cash"} />}     onClick={() => handleAccountToggle("cash")} />
          <AccountCard label="QRIS"   balance={closingQris}   active={activeAccount === "qris"}   cat={CATEGORY.qris}   icon={<QrisIcon active={activeAccount === "qris"} />}     onClick={() => handleAccountToggle("qris")} />
          <AccountCard label="Online" balance={closingOnline} active={activeAccount === "online"} cat={CATEGORY.online} icon={<OnlineIcon active={activeAccount === "online"} />} onClick={() => handleAccountToggle("online")} />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? <TableSkeleton /> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Header — dark neutral charcoal, small icons for identity */}
                <thead>
                  <tr className="bg-gray-800 text-gray-200">
                    <th rowSpan={2} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest w-24">Date</th>
                    <th rowSpan={2} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest border-r border-gray-700">Description</th>
                    {showCash && <th colSpan={2} className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest border-l-2 border-gray-600">{headerIcon.cash}Cash</th>}
                    {showQris && <th colSpan={2} className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest border-l-2 border-gray-600">{headerIcon.qris}QRIS</th>}
                    {showOnline && <th colSpan={2} className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest border-l-2 border-gray-600">{headerIcon.online}Online</th>}
                  </tr>
                  <tr className="bg-gray-700 text-gray-400">
                    {showCash && <><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest border-l-2 border-gray-600">Amt</th><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest">Bal</th></>}
                    {showQris && <><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest border-l-2 border-gray-600">Amt</th><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest">Bal</th></>}
                    {showOnline && <><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest border-l-2 border-gray-600">Amt</th><th className="text-right px-5 py-2 text-[10px] font-medium uppercase tracking-widest">Bal</th></>}
                  </tr>
                </thead>

                <tbody>
                  {displayRows.map((row, idx) => {
                    const isOpening = row.rowType === "opening";
                    const isClosing = row.rowType === "closing";
                    const isHL = isOpening || isClosing;
                    const isExpense = row.rowType === "expense";
                    const isSales = row.rowType === "sales";
                    const isDisc = row.rowType === "discrepancy";
                    const isAdjustment = row.rowType === "adjustment";
                    const hasDate = row.date !== "";

                    const prevRow = idx > 0 ? displayRows[idx - 1] : null;
                    const isDayStart = hasDate && row.rawDate !== "" && (!prevRow || prevRow.rawDate !== row.rawDate || prevRow.rowType === "opening");

                    // Subtle row tints (2% opacity semantic backgrounds)
                    let rowBg = "";
                    if (isClosing) rowBg = "bg-slate-200";
                    else if (isOpening) rowBg = "bg-slate-50";
                    else if (isSales) rowBg = "bg-emerald-50/30";
                    else if (isExpense) rowBg = "bg-red-50/25";
                    else if (isDisc) rowBg = "bg-amber-50/25";
                    else if (isAdjustment) rowBg = "bg-blue-50/25";

                    const daySep = isClosing ? "border-t-2 border-slate-400" : isDayStart && !isOpening ? "border-t-2 border-gray-200" : "border-t border-gray-100";

                    const descStyle = isHL
                      ? "font-bold text-gray-900"
                      : isExpense
                      ? "font-semibold text-gray-800 cursor-help"
                      : "font-semibold text-gray-800";

                    return (
                      <tr key={idx} className={`${rowBg} ${daySep} transition-colors hover:bg-gray-100/50`}>
                        {/* Date — small, gray */}
                        <td className={`px-5 py-3 whitespace-nowrap text-xs ${hasDate ? "text-slate-400 font-medium" : ""}`}>
                          {row.date}
                        </td>

                        {/* Description — darker, bolder */}
                        <td className="px-5 py-3 whitespace-nowrap border-r border-gray-100">
                          <div
                            className="flex items-center relative"
                            onMouseEnter={() => {
                              if (isExpense) setHoveredExpenseIdx(idx);
                              if (isDisc) setHoveredDiscIdx(idx);
                              if (isAdjustment) setHoveredAdjIdx(idx);
                            }}
                            onMouseLeave={() => {
                              setHoveredExpenseIdx(null);
                              setHoveredDiscIdx(null);
                              setHoveredAdjIdx(null);
                            }}
                          >
                            <span className={`text-sm ${descStyle}`}>{row.description}</span>
                            {isDisc && !row.isDiscrepancyConfirmed && (
                              <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            )}
                            {isOpening && <button onClick={() => setShowBalanceModal(true)} className="ml-2 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit opening balance"><PencilIcon /></button>}
                            {hoveredExpenseIdx === idx && <ExpenseTooltip row={row} />}
                            {hoveredDiscIdx === idx && isDisc && (
                              <DiscrepancyTooltip
                                row={row}
                                onConfirm={() => { setHoveredDiscIdx(null); openDiscrepancyModal(row, "confirm"); }}
                                onReject={() => { setHoveredDiscIdx(null); openDiscrepancyModal(row, "reject"); }}
                                onUndo={() => { setHoveredDiscIdx(null); openDiscrepancyModal(row, "undo"); }}
                              />
                            )}
                            {hoveredAdjIdx === idx && isAdjustment && (
                              <AdjustmentTooltip
                                row={row}
                                onUndo={() => { setHoveredAdjIdx(null); handleUndoAnchor(row.rawDate); }}
                              />
                            )}
                          </div>
                        </td>

                        {/* Cash */}
                        {showCash && <>
                          <td className="px-5 py-3 text-right whitespace-nowrap border-l-2 border-gray-200">{renderAmt(row.cashAmount, isHL)}</td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">{renderBal(row.cashBalance, isClosing)}</td>
                        </>}

                        {/* QRIS */}
                        {showQris && <>
                          <td className="px-5 py-3 text-right whitespace-nowrap border-l-2 border-gray-200">{renderAmt(row.qrisAmount, isHL)}</td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">{renderBal(row.qrisBalance, isClosing)}</td>
                        </>}

                        {/* Online */}
                        {showOnline && <>
                          <td className="px-5 py-3 text-right whitespace-nowrap border-l-2 border-gray-200">{renderAmt(row.onlineAmount, isHL)}</td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">{renderBal(row.onlineBalance, isClosing)}</td>
                        </>}
                      </tr>
                    );
                  })}

                  {displayRows.length === 0 && (
                    <tr><td colSpan={colCount} className="text-center py-16 text-gray-400 text-base">No data for this month yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showBalanceModal && <OpeningBalanceModal balance={openingBalance} onSave={handleSaveBalance} onClose={() => setShowBalanceModal(false)} />}
      {showExpenseModal && <AddExpenseModal onSave={handleAddExpense} onClose={() => setShowExpenseModal(false)} />}
      {showAnchorModal && <AnchorBalanceModal txnData={txnData} onAnchor={handleAnchorBalance} onClose={() => setShowAnchorModal(false)} loading={anchorLoading} />}
      {discrepancyModal?.type === "confirm" && <ConfirmDiscrepancyModal info={discrepancyModal.info} onConfirm={handleConfirmDiscrepancy} onClose={() => setDiscrepancyModal(null)} loading={discrepancyLoading} />}
      {discrepancyModal?.type === "reject" && <RejectDiscrepancyModal info={discrepancyModal.info} onReject={handleRejectDiscrepancy} onClose={() => setDiscrepancyModal(null)} loading={discrepancyLoading} />}
      {discrepancyModal?.type === "undo" && <UndoDiscrepancyModal dateFmt={discrepancyModal.info.dateFmt} onUndo={handleUndoDiscrepancy} onClose={() => setDiscrepancyModal(null)} loading={discrepancyLoading} />}
    </div>
  );
}
