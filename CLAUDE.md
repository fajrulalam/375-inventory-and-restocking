# 375 Dashboard — Project Knowledge

## Stack

- **Framework**: Next.js 15.3 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: Firebase Firestore (client SDK v11)
- **Deployment**: Static/SSR via Next.js

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout, wraps with TestingModeProvider
│   ├── globals.css         # Base styles, bg: gray-50
│   ├── page.tsx            # Main dashboard (transactions, histogram, orders)
│   ├── analyse/page.tsx    # Historical analysis page (independent design)
│   ├── cashflow/page.tsx   # Monthly cashflow statement with PDF export
│   └── reviews/page.tsx    # Customer feedbacks page
├── components/
│   ├── Sidebar.tsx         # Slide-in navigation (hamburger-triggered)
│   ├── TransactionTile.tsx # Revenue cards with real-time Firestore listeners
│   ├── HourlyHistogramTile.tsx  # Hourly chart shell (wraps HourlyHistogram)
│   ├── HourlyHistogram.tsx      # The actual Recharts histogram (DO NOT TOUCH)
│   ├── ServedOrdersTile.tsx     # Served + pending orders with tabs
│   ├── TabComponent.tsx         # Reusable tab UI
│   ├── HistoricalDataModal.tsx  # Modal with historical chart (DO NOT TOUCH chart)
│   └── ...other modals/components
├── contexts/
│   └── TestingModeContext.tsx   # Testing mode state + banner + cache clearing
├── config/
│   └── firebase.ts         # Firebase config from env vars
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
| `DailyTransaction` | page.tsx, analysisDataUtils, historicalDataUtils | doc by date `YYYY-MM-DD` |
| `MonthlyTransaction` | page.tsx, historicalDataUtils | doc by month `YYYY-MM` |
| `YearlyTransaction` | page.tsx, historicalDataUtils | doc by year `YYYY` |
| `RecentlyServed` | hourlyHistogramUtils | query by `timestampServe >= startOfDay` |
| `Status` | hourlyHistogramUtils | query all pending orders |
| `feedbacks` | feedbackUtils | query ordered by timestamp |
| `Canteens` | not directly used in dashboard code |
| `Categories` | not directly used in dashboard code |
| `Members` | not directly used in dashboard code |
| `Expenses` | cashflowUtils | query by `timestamp` range per month |
| `CashflowSettings` | cashflowUtils | doc by month `YYYY-MM` (opening balances) |
| `Stock`, `OrderHistory`, etc. | not directly used in dashboard code |

## Testing Mode

- **Toggle**: Flask icon button in header (top right)
- **Visual indicator**: Fixed amber banner at page top when active
- **Mechanism**: `getCollectionPath(name)` in `src/utils/testingMode.ts` prefixes root collection segment with `zTesting_`
- **State**: Module-level variable synced with React context (`TestingModeContext`)
- **Persistence**: Stored in `localStorage` key `"testingMode"`
- **Cache safety**: All cache keys are prefixed with `test_` when testing mode is active. `clearAllCache()` is called on every toggle to prevent cross-contamination.
- **Firestore rules**: `zTesting_*` collections have `allow read, write, update, delete: if true` (no auth required)
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

## Order Data Model (RecentlyServed / Status)

Orders have been enriched with:

```typescript
interface OrderItem {
  namaPesanan: string;
  quantity: number;
  selectedOptions?: SelectedOption[];  // NEW — array of chosen options
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
  isMember: boolean;         // NEW — shows purple badge when true
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

## Key Patterns

- **Firebase init**: Each page (`page.tsx`, `analyse/page.tsx`, `reviews/page.tsx`, `cashflow/page.tsx`) initializes its own Firebase app instance at module level
- **Real-time listeners**: `TransactionTile` and `ServedOrdersTile` use `onSnapshot` for live updates; cleanup via useEffect return
- **Sound effect**: `TransactionTile` plays a cha-ching sound when the total changes in real-time
- **Responsive modals**: Desktop = centered dialog, mobile = bottom sheet (via `useMediaQuery`)

## Cashflow Statement (`/cashflow`)

Monthly ledger tracking Cash, QRIS, and Online account balances.

### Data Sources
- **Sales**: `DailyTransaction` — uses `actualCash`/`actualOnline`/`actualQris` (fallback: `totalCash`/`totalOnline`/`totalQris`)
- **Discrepancy**: `DailyTransaction` — `discrepancyCash`/`discrepancyOnline`/`discrepancyQris` (shown only when non-zero)
- **Expenses**: `Expenses` collection — each doc is its own row, `category` as description, `sourceAccount` determines which account column, amount is displayed as negative
- **Opening Balance**: `CashflowSettings` collection (doc ID = `YYYY-MM`) — overrides auto-calculated opening. Falls back to previous month's last `DailyTransaction.closingCash`/`closingOnline`/`closingQris`

### Row Order Per Day
Opening Balance (day 1 only) → Sales → Discrepancy (if non-zero) → Individual Expenses → ... → Closing Balance (end of month)

### Account Filter
Three floating buttons (Cash/QRIS/Online) at top. Clicking one filters table to that account's columns and relevant rows only. Click again to deselect.

### PDF Export
Uses `jspdf` + `jspdf-autotable`. Landscape layout, always exports all accounts regardless of active filter.

## Authentication

- **Gate**: `AuthGate` component in `layout.tsx` wraps `TestingModeProvider` — nothing renders until user is authenticated
- **Provider**: `AuthContext` uses Firebase Auth `onAuthStateChanged` to track login state
- **Login**: `LoginScreen` component with email/password, styled to match design system
- **Sign out**: Available in Sidebar footer, shows user email + "Sign out" link
- **User management**: Users are created in Firebase Console backend — no signup page exists
- **Flow**: `AuthProvider` > `AuthGate` > `TestingModeProvider` > page content

## Important Warnings

- **DO NOT** touch chart internals (`HourlyHistogram.tsx`, chart inside `HistoricalDataModal.tsx`)
- **DO NOT** touch the Historical Analysis page (`analyse/page.tsx`) design
- When adding new Firestore collection references, ALWAYS wrap with `getCollectionPath()`
- When adding new cache keys, ALWAYS prefix with testing mode awareness
- `calculateItemMedians` applies `getCollectionPath` internally — pass raw names to it
