import type { ApiErrorPayload, AuthTokenResponse, FieldErrorItem } from "@/types/auth";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrorItem[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: FieldErrorItem[] = [],
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }
}

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<AuthTokenResponse | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setOnUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  skipAuthRefresh?: boolean;
  signal?: AbortSignal;
};

async function parseError(response: Response): Promise<ApiError> {
  const fallback = response.statusText || `HTTP ${response.status}`;
  try {
    const payload = (await response.json()) as Partial<ApiErrorPayload>;
    return new ApiError(
      response.status,
      payload.code || `HTTP_${response.status}`,
      payload.message || fallback,
      payload.fieldErrors || [],
      payload.requestId
    );
  } catch {
    return new ApiError(response.status, `HTTP_${response.status}`, fallback);
  }
}

export async function refreshSessionToken(): Promise<AuthTokenResponse | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await response.json()) as AuthTokenResponse;
      setAccessToken(data.accessToken);
      return data;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers: customHeaders = {},
    idempotencyKey,
    skipAuthRefresh = false,
    signal,
  } = options;

  const buildHeaders = () => {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...customHeaders,
    };
    if (body !== undefined && !(body instanceof FormData)) {
      h["Content-Type"] = "application/json";
    }
    if (inMemoryAccessToken) {
      h["Authorization"] = `Bearer ${inMemoryAccessToken}`;
    }
    if (idempotencyKey) {
      h["Idempotency-Key"] = idempotencyKey;
    }
    return h;
  };

  const execute = () =>
    fetch(path, {
      method,
      credentials: "include",
      headers: buildHeaders(),
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal,
    });

  let response = await execute();

  const isAuthEndpoint =
    path.startsWith("/api/v1/auth/login") ||
    path.startsWith("/api/v1/auth/refresh") ||
    path.startsWith("/api/v1/auth/logout");

  if (response.status === 401 && !skipAuthRefresh && !isAuthEndpoint) {
    const refreshed = await refreshSessionToken();
    if (refreshed?.accessToken) {
      response = await execute();
    } else {
      unauthorizedHandler?.();
      throw new ApiError(401, "UNAUTHORIZED", "Session expired. Please sign in again.");
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
