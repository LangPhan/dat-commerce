export type FieldErrorItem = {
  field: string;
  message: string;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  fieldErrors?: FieldErrorItem[];
  requestId?: string;
  timestamp?: string;
};

export type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AuthUser = {
  id: string;
  storeId: string;
  storeName: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  demo?: boolean;
  demoExpiresAt?: string | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
};

export type RoleSummary = {
  code: string;
  name: string;
  description: string | null;
};

export type StoreInfo = {
  id: string;
  code: string;
  name: string;
  defaultCurrency: string;
  locale: string;
  timezone: string;
  contactEmail: string | null;
  publicDomain: string | null;
  status: string;
  settingsJson: Record<string, unknown>;
  updatedAt: string;
};

export type AuditLogRecord = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown>;
  createdAt: string;
};
