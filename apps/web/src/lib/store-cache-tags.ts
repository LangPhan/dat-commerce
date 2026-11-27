export const STORE_CACHE_TAGS = {
  theme: "store-theme",
  navigation: "store-nav",
  experience: "store-experience",
  pages: "store-pages",
  page: (slug: string) => `store-page:${slug.toLowerCase()}`,
  catalog: "store-catalog",
  categories: "store-categories",
  collections: "store-collections",
  presets: "store-presets",
} as const;
