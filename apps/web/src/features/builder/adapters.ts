import { cmsAdminApi } from "@/lib/cms-ai-api";
import { storeApi } from "@/lib/commerce-api";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type {
  AdminThemeResponse,
  PageDetailDto,
  PageSummaryDto,
  ThemeTokens,
  ThemeVersionDto,
} from "@/types/api-cms-ai";
import type { PageDocumentV2 } from "./types";

/**
 * Decoupled CMS persistence boundary so the Visual Editor can later target
 * Payload CMS 3 or another backend without changing canvas/inspector logic.
 */
export interface PagePersistenceAdapter {
  listPages: () => Promise<PageSummaryDto[]>;
  getPage: (pageId: string) => Promise<PageDetailDto>;
  createPage: (body: {
    slug: string;
    title: string;
    seoTitle?: string;
    seoDescription?: string;
    content?: PageDocumentV2;
  }) => Promise<PageDetailDto>;
  saveDraft: (params: {
    pageId: string;
    document: PageDocumentV2;
    changeSummary?: string;
    title?: string;
    seoTitle?: string;
    seoDescription?: string;
    expectedVersion?: number;
  }) => Promise<PageDetailDto>;
  publishPage: (params: {
    pageId: string;
    versionId?: string;
    expectedVersion?: number;
  }) => Promise<PageDetailDto>;
  rollbackPage: (pageId: string, versionId: string) => Promise<PageDetailDto>;
  getTheme: () => Promise<AdminThemeResponse>;
  saveThemeDraft: (tokens: ThemeTokens, note?: string) => Promise<ThemeVersionDto>;
  publishTheme: (versionId?: string) => Promise<ThemeVersionDto>;
}

/**
 * Decoupled Commerce catalog boundary so Ecommerce elements can later bind to
 * Medusa v2 without touching rendering components.
 */
export interface CommerceDataAdapter {
  listProducts: () => Promise<ProductDto[]>;
  listCategories: () => Promise<CategoryDto[]>;
}

export function createRestPageAdapter(): PagePersistenceAdapter {
  return {
    listPages: () => cmsAdminApi.listPages(),
    getPage: (pageId) => cmsAdminApi.getPage(pageId),
    createPage: (body) =>
      cmsAdminApi.createPage({
        ...body,
        content: body.content,
      }),
    saveDraft: ({
      pageId,
      document,
      changeSummary,
      title,
      seoTitle,
      seoDescription,
      expectedVersion,
    }) =>
      cmsAdminApi.createPageVersion(pageId, {
        content: document,
        changeSummary,
        title,
        seoTitle,
        seoDescription,
        expectedVersion,
      }),
    publishPage: ({ pageId, versionId, expectedVersion }) =>
      cmsAdminApi.publishPage(pageId, { versionId, expectedVersion }),
    rollbackPage: (pageId, versionId) => cmsAdminApi.rollbackPage(pageId, versionId),
    getTheme: () => cmsAdminApi.getTheme(),
    saveThemeDraft: (tokens, note) => cmsAdminApi.createThemeVersion(tokens, note),
    publishTheme: (versionId) => cmsAdminApi.publishTheme(versionId),
  };
}

export function createRestCommerceAdapter(): CommerceDataAdapter {
  return {
    listProducts: async () => {
      const page = await storeApi.listProducts({ size: 24 });
      return page.items || [];
    },
    listCategories: () => storeApi.listCategories(),
  };
}
