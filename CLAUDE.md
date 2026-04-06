# 375 Dashboard — Project Knowledge

## Stack

- **Framework**: Next.js 15.5 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: Firebase Firestore (client SDK v11)
- **Auth**: Firebase Authentication (email/password)
- **PDF**: jsPDF 4 + jspdf-autotable 5
- **Fonts**: Geist Sans + Geist Mono (via `next/font/google`)
- **Deployment**: Vercel

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout: AuthProvider > AuthGate > TestingModeProvider
│   ├── globals.css         # Base styles, bg: gray-50, font smoothing
│   ├── page.tsx            # Main dashboard (transactions, histogram, orders)
│   ├── analyse/page.tsx    # Historical analysis page (independent design — DO NOT TOUCH)
│   ├── cashflow/page.tsx   # Monthly cashflow statement with PDF export
│   └── reviews/page.tsx    # Customer feedbacks page
├── components/
│   ├── Sidebar.tsx         # Slide-in navigation (hamburger-triggered), sign-out
│   ├── AuthGate.tsx        # Renders LoginScreen or loading spinner until authenticated
│   ├── LoginScreen.tsx     # Email/password login form, 375 branding
│   ├── TransactionTile.tsx # Revenue cards with real-time Firestore listeners
│   ├── HourlyHistogramTile.tsx  # Hourly chart shell (wraps HourlyHistogram)
│   ├── HourlyHistogram.tsx      # The actual Recharts histogram (DO NOT TOUCH)
│   ├── ServedOrdersTile.tsx     # Served + pending orders with tabs
│   ├── TabComponent.tsx         # Reusable tab UI
│   ├── HistoricalDataModal.tsx  # Modal with historical chart (DO NOT TOUCH chart)
│   ├── WeeklyMedianCard.tsx     # Weekly median display card
│   ├── WeeklyMedianModal.tsx    # Weekly median detail modal
│   ├── TransactionModal.tsx     # Transaction detail modal
│   ├── DailyTransactionTile.tsx # Daily transaction list tile
│   ├── DailyTransactionListItem.tsx # Individual transaction list item
│   ├── ItemFilter.tsx           # Filter UI component
│   ├── DatePicker.tsx           # Date picker component
│   ├── BoxPlotChart.tsx         # Box plot visualization
│   ├── BoxPlotModal.tsx         # Box plot detail modal
│   └── CustomBarChart.tsx       # Custom bar chart component
├── contexts/
│   ├── AuthContext.tsx          # Firebase Auth state, signIn/signOut methods
│   └── TestingModeContext.tsx   # Testing mode state + pill indicator + cache clearing
├── config/
│   └── firebase.ts         # Firebase config from env vars (.env.local)
└── utils/
    ├── testingMode.ts      # Module-level testing state + getCollectionPath()
    ├── hourlyHistogramUtils.ts  # Firestore queries for RecentlyServed, Status
    ├── historicalDataUtils.ts   # Firestore queries for Monthly/Yearly history
    ├── analysisDataUtils.ts     # Firestore queries for DailyTransaction analysis
    ├── cashflowUtils.ts         # Cashflow Firestore queries, row builder, PDF gen
    ├── feedbackUtils.ts         # Firestore queries for feedbacks collection
    ├── cacheUtils.ts            # localStorage cache with Jakarta midnight expiry
    ├── formatters.ts            # Currency formatting, date formatting
    ├── dateUtils.ts             # Date helpers, median calculation
    └── useMediaQuery.ts         # Responsive breakpoint hook
```

## Firestore Collections (Root Level)

All root collections used by the app. When testing mode is active, every collection is prefixed with `zTesting_` (e.g., `DailyTransaction` → `zTesting_DailyTransaction`).

| Collection | Used In | Access Pattern |
|---|---|---|
| `DailyTransaction` | page.tsx, analysisDataUtils, historicalDataUtils, cashflowUtils | doc by date `YYYY-MM-DD`, query by `month` field |
| `MonthlyTransaction` | page.tsx, historicalDataUtils, cashflowUtils | doc by month `YYYY-MM` |
| `YearlyTransaction` | page.tsx, historicalDataUtils | doc by year `YYYY` |
| `RecentlyServed` | hourlyHistogramUtils | query by `timestampServe >= startOfDay` |
| `Status` | hourlyHistogramUtils | query all pending orders |
| `feedbacks` | feedbackUtils | query ordered by timestamp |
| `Expenses` | cashflowUtils | query by `timestamp` range per month |
| `CashflowSettings` | cashflowUtils | doc by month `YYYY-MM` (opening balances) |
| `Canteens` | not directly used in dashboard code |
| `Categories` | not directly used in dashboard code |
| `Members` | not directly used in dashboard code |
| `Stock`, `OrderHistory`, etc. | not directly used in dashboard code |

### DailyTransaction Document Fields

```typescript
{
  date: string;          // "YYYY-MM-DD"
  month: string;         // "YYYY-MM" — used for querying
  total: number;         // Grand total (system-recorded, updated on confirm)
  subTotal: number;      // total - takeAwayFee (updated on confirm)
  totalCash: number;     // System-recorded cash sales
  totalOnline: number;   // System-recorded online sales
  totalQris: number;     // System-recorded QRIS sales
  actualCash?: number;   // Cashier-counted cash (end of day)
  actualOnline?: number; // Cashier-counted online (end of day)
  actualQris?: number;   // Cashier-counted QRIS (end of day)
  closingCash: number;   // Running balance at end of day (NOT modified by confirm)
  closingOnline: number;
  closingQris: number;
  // Discrepancy confirmation fields (written by confirm/reject flow):
  isDiscrepancyConfirmed?: boolean;
  preConfirmTotal?: number;     // Stored for undo
  preConfirmSubTotal?: number;  // Stored for undo
  confirmedDeltaCash?: number;  // actual - total (stored for undo)
  confirmedDeltaQris?: number;
  confirmedDeltaOnline?: number;
  originalActualCash?: number;  // Stored when overriding (reject), for undo
  originalActualQris?: number;
  originalActualOnline?: number;
}
```

**Note**: `discrepancyCash`/`discrepancyOnline`/`discrepancyQris` fields exist in the document but are **ignored** by the app. Discrepancy is always calculated on the fly as `actual* - total*`.

### Expenses Document Fields

```typescript
{
  amount: number;
  sourceAccount: string;      // "cash" | "qris" | "online"
  category: string;           // Description shown in cashflow
  timestamp: Timestamp;       // Firestore Timestamp
  canteenId?: string;         // e.g., "canteen375_plazaUnipdu"
  addedFromDashboardWeb?: boolean;  // true if added via web dashboard
}
```

## Authentication

- **Gate**: `AuthGate` component in `layout.tsx` wraps `TestingModeProvider` — nothing renders until user is authenticated
- **Provider**: `AuthContext` uses Firebase Auth `onAuthStateChanged` to track login state
- **Login**: `LoginScreen` component with email/password, styled to match design system
- **Sign out**: Available in Sidebar footer, shows user email + "Sign out" link
- **User management**: Users are created in Firebase Console backend — no signup page exists
- **Component hierarchy**: `AuthProvider` > `AuthGate` > `TestingModeProvider` > page content

### Firestore Security Rules

- **Production collections**: Require `isAuthenticated()` for read, `isAdmin()` for write
- **Admin check**: Matches `request.auth.token.admin == true` OR specific email addresses
- **`zTesting_*` collections**: `allow read, write, update, delete: if true` (no auth required)
- **`CashflowSettings`**: read = authenticated, write = admin
- **`zTesting_CashflowSettings`**: fully open
- **`Status`, `RecentlyServed`**: fully open (POS system needs unauthenticated access)

## Testing Mode

- **Toggle**: Flask icon button in header (top right)
- **Visual indicator**: Fixed amber pill ("TESTING") in bottom-right corner (`z-50`, pointer-events-none)
- **Mechanism**: `getCollectionPath(name)` in `src/utils/testingMode.ts` prefixes root collection segment with `zTesting_`
- **State**: Module-level variable synced with React context (`TestingModeContext`)
- **Persistence**: Stored in `localStorage` key `"testingMode"`
- **Cache safety**: All cache keys are prefixed with `test_` when testing mode is active. `clearAllCache()` is called on every toggle to prevent cross-contamination.
- **Reactivity**: `isTestingMode` is in the dependency array of all data-fetching `useEffect` hooks so data re-fetches on toggle

### Collection path resolution

```typescript
// Production:  "DailyTransaction" → "DailyTransaction"
// Testing:     "DailyTransaction" → "zTesting_DailyTransaction"
// Subcollections: "Canteens/canteen375/Logs" → "zTesting_Canteens/canteen375/Logs"
getCollectionPath(collectionPath: string): string
```

Utility functions (historicalDataUtils, hourlyHistogramUtils, etc.) call `getCollectionPath()` internally — callers pass raw collection names, never pre-prefixed.

**Exception**: `calculateItemMedians` in historicalDataUtils applies `getCollectionPath` internally, so callers in page.tsx pass the raw name (e.g., `"DailyTransaction"`, NOT `getCollectionPath("DailyTransaction")`).

## Design System

Established during the front-page redesign. All front-page components follow this system.

### Base Tokens

| Token | Value |
|---|---|
| Page background | `bg-gray-50` |
| Card | `bg-white rounded-xl border border-gray-100 shadow-sm` |
| Card title | `text-sm font-medium text-gray-500` |
| Hero number | `text-3xl font-bold text-gray-900 tracking-tight` |
| Secondary text | `text-gray-600` |
| Muted text | `text-gray-400` |
| Skeleton pulse | `bg-gray-100 rounded-lg` |
| Dividers | `border-gray-100` (solid) or `border-dashed border-gray-200/80` |
| Pill toggles | Container: `bg-gray-100 rounded-lg`, active: `bg-white text-gray-800 shadow-sm` |
| Icon buttons | `p-2 rounded-xl border border-gray-100 bg-white shadow-sm` |
| Dark badge | `bg-gray-800 text-white rounded-lg` (e.g., customer number) |
| Member indicator | `bg-purple-50 text-purple-700 border-purple-200` with purple person icon |
| Option pills | `bg-gray-700 text-gray-100 text-[11px] font-semibold rounded` |
| Tab active | `text-gray-900 border-gray-900` |
| Tab inactive | `text-gray-400 border-transparent` |

### Cashflow Page Design Tokens

| Token | Value |
|---|---|
| Table main container | `bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden` |
| Table header (top) | `bg-gray-800 text-gray-200` (dark charcoal) |
| Table sub-header | `bg-gray-700 text-gray-300` |
| Header icons | Small inline SVGs (wallet, QR, motorbike) at 14px, `opacity-50` |
| Account separators (header) | `border-l-2 border-gray-600` |
| Account separators (body) | `border-l-2 border-gray-200` |
| Sales row tint | `bg-emerald-50/30` |
| Expense row tint | `bg-red-50/25` |
| Discrepancy row tint | `bg-amber-50/25` |
| Closing balance row | `bg-slate-200 border-t-2 border-slate-400`, bold balance |
| Amount text (positive) | `text-emerald-700 font-medium` with `+` prefix |
| Amount text (negative) | `text-red-600 font-medium` with `-` prefix |
| Balance text (normal rows) | `text-xs text-gray-400` (lighter, smaller, NOT bold) |
| Balance text (closing row) | `font-bold text-gray-900` (bold, dark) |
| Balance text (negative) | `text-red-500` |
| Date column | `text-xs text-slate-400 font-medium`, date shown once per day |
| Description text | `font-semibold text-gray-800` |
| Numbers | Monospace font via `font-[var(--font-geist-mono)]`, right-aligned |
| No currency prefix | Table body uses raw numbers only (no "Rp"). Cards use "Rp" |

### Account Filter Cards

Three clickable cards at the top showing closing balance per account. Colors per account:
- Cash: `bg-slate-700` (active), wallet icon
- QRIS: `bg-blue-700` (active), QR/barcode icon
- Online: `bg-purple-700` (active), motorbike/delivery icon

Clicking a card filters the table to show only that account's columns and relevant rows.

## Order Data Model (RecentlyServed / Status)

Orders have been enriched with:

```typescript
interface OrderItem {
  namaPesanan: string;
  quantity: number;
  selectedOptions?: SelectedOption[];
}

interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;       // Displayed as pills in the UI
  priceAdjustment: number;
}

interface Order {
  customerNumber: string;
  namaCustomer: string;
  isMember: boolean;         // Shows purple badge when true
  orderItems: OrderItem[];
  // ...other fields
}
```

## Caching

- Uses `localStorage` with prefix `app_cache_`
- Expires at midnight Jakarta time (UTC+7)
- Cache keys MUST be prefixed with `test_` when `isTestingMode` is true
- `clearAllCache()` is called whenever testing mode is toggled
- Managed via `src/utils/cacheUtils.ts`

## Cashflow Statement (`/cashflow`)

Monthly ledger tracking Cash, QRIS, and Online account balances.

### Data Sources
- **Sales**: `DailyTransaction` — always uses `totalCash`/`totalOnline`/`totalQris` (system-recorded)
- **Discrepancy**: Calculated on the fly as `actualCash - totalCash` (etc.). Row only appears when `actual*` fields exist AND at least one discrepancy is non-zero. The stored `discrepancy*` fields in Firestore are **ignored**.
- **Expenses**: `Expenses` collection — each doc is its own row, `category` as description, `sourceAccount` determines which account column, amount displayed as negative
- **Opening Balance**: `CashflowSettings` collection (doc ID = `YYYY-MM`) — overrides auto-calculated opening. Falls back to previous month's last `DailyTransaction.closingCash`/`closingOnline`/`closingQris`. Editable via pencil icon.

### Row Order Per Day
Opening Balance (day 1 only) → Sales → Discrepancy (if non-zero) → Individual Expenses → ... → Closing Balance (end of month)

### Discrepancy Confirm / Reject / Undo Flow

Discrepancy rows show up when `actual*` fields exist and differ from `total*` fields.

**Confirm**: Accepts the discrepancy as-is.
- Calculates delta = `actual* - total*` for each account
- Stores `preConfirmTotal`, `preConfirmSubTotal`, `confirmedDelta*` on `DailyTransaction` for undo
- Updates `total` and `subTotal` on `DailyTransaction` (subTotal = total - takeAwayFee)
- Atomically increments `total`, `totalCash`, `totalQris`, `totalOnline` on `MonthlyTransaction/{YYYY-MM}` and `YearlyTransaction/{YYYY}` using `writeBatch` + Firestore `increment()`
- Sets `isDiscrepancyConfirmed: true`
- Does NOT modify `closing*` fields

**Override (Reject)**: User edits `actual*` values, then triggers same logic as Confirm with edited values.
- Stores `originalActual*` (original cashier values) before overwriting `actual*` on `DailyTransaction`
- Override modal inputs have thousand-separator formatting (`Intl.NumberFormat("id-ID")`)

**Undo**: Reverts a confirmed/overridden discrepancy.
- Restores `total` and `subTotal` from `preConfirmTotal`/`preConfirmSubTotal`
- Decrements Monthly/Yearly aggregates by the negative of `confirmedDelta*`
- Restores `actual*` from `originalActual*` if they exist (override case)
- Removes all confirmation metadata fields using `deleteField()`

**UI Behavior**:
- Unconfirmed discrepancy: small pulsing amber dot next to "Discrepancy" text
- Confirmed discrepancy: no visual indicator at all (clean, uncluttered)
- On hover over any discrepancy row: tooltip appears with amounts and action buttons (Confirm/Override for unconfirmed, Confirmed status + Undo for confirmed)
- Tooltip uses frosted-glass style (`bg-white/95 backdrop-blur-sm`), seamless hover area (no gap between trigger and tooltip)

### Account Filter
Three floating cards (Cash/QRIS/Online) at top showing closing balance. Clicking one filters table to that account's columns and relevant rows only. Click again to deselect.

### Add Expense
- Only available for the current (ongoing) month
- "Add expense" text button at bottom of table
- Modal with: description, amount (thousand-separator formatting, `inputMode="numeric"`), source account selection (uniform color when selected)
- Writes to `Expenses` collection with `addedFromDashboardWeb: true` and `Timestamp.now()`
- Hovering an expense row shows tooltip with timestamp and source indicator

### PDF Export
Uses `jspdf` + `jspdf-autotable`. Landscape layout, always exports all accounts regardless of active filter. Styled to match the table design: dark charcoal headers, semantic row tints, monospace numbers, no "Rp" prefix.

### Timezone Handling
All date calculations use Jakarta time (UTC+7). Expense timestamps are converted from UTC using Jakarta timezone offset for date bucketing.

## Navigation

- **Sidebar**: Slide-in panel triggered by hamburger icon in header
- **Routes**:
  - `/` — Dashboard (main page)
  - `/analyse` — Historical Analysis
  - `/cashflow` — Cashflow Statement
  - `/reviews` — Feedbacks
- **Active route**: Highlighted with `bg-gray-900 text-white`
- **Footer**: Shows user email + "Sign out" link + "375 Technology" branding

## Key Patterns

- **Firebase init**: Each page (`page.tsx`, `analyse/page.tsx`, `reviews/page.tsx`, `cashflow/page.tsx`) initializes its own Firebase app instance at module level via `initializeApp(firebaseConfig)` with `getApps()` dedup
- **Real-time listeners**: `TransactionTile` and `ServedOrdersTile` use `onSnapshot` for live updates; cleanup via useEffect return
- **Sound effect**: `TransactionTile` plays a cha-ching sound when the total changes in real-time
- **Responsive modals**: Desktop = centered dialog, mobile = bottom sheet (via `useMediaQuery`)
- **Historical medians**: Fetches last 12 months for MonthlyTransaction and last 10 years for YearlyTransaction
- **Monospace utility**: `const MONO = "font-[var(--font-geist-mono)]"` used throughout cashflow page for number alignment

## Environment

- **Env file**: `.env.local` contains Firebase config (`NEXT_PUBLIC_FIREBASE_*` vars)
- **Timezone**: All business logic uses `Asia/Jakarta` (UTC+7)
- **Deployment target**: Vercel (Next.js static/SSR)

## Important Warnings

- **DO NOT** touch chart internals (`HourlyHistogram.tsx`, chart inside `HistoricalDataModal.tsx`)
- **DO NOT** touch the Historical Analysis page (`analyse/page.tsx`) design
- When adding new Firestore collection references, ALWAYS wrap with `getCollectionPath()`
- When adding new cache keys, ALWAYS prefix with testing mode awareness
- `calculateItemMedians` applies `getCollectionPath` internally — pass raw names to it
- The `next-env.d.ts` file must be writable by the build process (was previously owned by root, caused build failures)
- Always check for CVE/security advisories when updating Next.js — Vercel blocks vulnerable versions
