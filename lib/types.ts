export type Named<K extends string> = { name: string } & Record<K, number>;

export type Kpis = {
  totalSales: number;
  totalProfit: number;
  totalOrders: number;
  avgOrder: number;
  avgMargin: number;
  lateRate: number;
  onTime: number;
  avgDelay: number;
};

export type Insight = {
  tone: "brand" | "mint" | "amber" | "red";
  label: string;
  text: string;
};

export type TrendPoint = { ym: string; sales: number; profit: number };
export type CountPoint = { name: string; count: number };
export type DelayBin = { days: number; count: number };
export type ScatterPoint = { d: number; p: number; m: number };
export type RegionPoint = { name: string; sales: number; profit: number };

export type TreemapNode = {
  name: string;
  sales: number;
  children?: TreemapNode[];
};

export type AnomalyRow = {
  date: string;
  product: string;
  market: string;
  shipMode: string;
  sales: number;
  profit: number;
  delay: number;
  type: string;
  severity: string;
};

export type AnomalyBlock = {
  counts: Record<string, number>;
  severity: Record<string, number>;
  leakImpact: number;
  rows: AnomalyRow[];
};

export type Aggregates = {
  kpis: Kpis;
  insights: Insight[];
  revenueByMarket: Named<"sales">[];
  trend: TrendPoint[];
  orderStatus: CountPoint[];
  topCategories: Named<"sales">[];
  revenueBySegment: Named<"sales">[];
  lateByShipMode: Named<"pct">[];
  deliveryStatus: CountPoint[];
  delayHistogram: DelayBin[];
  lateByMarket: Named<"pct">[];
  profitByMarket: Named<"profit">[];
  marginByCategory: Named<"margin">[];
  discountVsProfit: ScatterPoint[];
  lossMakingProducts: Named<"profit">[];
  anomalies: AnomalyBlock;
  treemap: TreemapNode[];
  topCountries: CountPoint[];
  revenueBands: CountPoint[];
  salesProfitByRegion: RegionPoint[];
};

export type Meta = {
  rows: number;
  epoch: string;
  layout: { name: string; dtype: "u8" | "u16" | "i8" }[];
  dims: {
    market: string[];
    segment: string[];
    shipMode: string[];
    dept: string[];
    status: string[];
    delivery: string[];
    category: string[];
    region: string[];
    country: string[];
    product: string[];
  };
  measures: { name: string; length: number }[];
  bands: { edges: number[]; labels: string[] };
  years: number[];
  dateRange: [string, string];
};

export type FilterKey =
  | "market"
  | "segment"
  | "shipMode"
  | "dept"
  | "year"
  | "status";

export type Filters = Record<FilterKey, string[]>;

export const EMPTY_FILTERS: Filters = {
  market: [],
  segment: [],
  shipMode: [],
  dept: [],
  year: [],
  status: [],
};
