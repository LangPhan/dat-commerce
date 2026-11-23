export * from "@/types/commerce";
export {
  initialAttributes as attributes,
  initialCategories as categoryData,
} from "@/mocks/catalog";
export {
  categorySalesBreakdown,
  initialActivity,
  initialDiscounts as discounts,
  initialMembers,
  initialOrders as orders,
  initialThreads,
  revenueSeries,
} from "@/mocks/operations";

export const sampleSales = [
  { week: "Oct 27", amount: 14800 },
  { week: "Nov 3", amount: 18420 },
  { week: "Nov 10", amount: 21390 },
  { week: "Nov 17", amount: 26840 },
  { week: "Nov 24", amount: 31450 },
];
