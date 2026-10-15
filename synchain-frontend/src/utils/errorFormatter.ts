/**
 * SynChain AI Supply Chain Intelligence System
 * Enterprise API Error Formatter Utility
 *
 * Safely parses and formats errors from FastAPI, Axios, and standard JavaScript.
 * Guarantees a human-readable string output, preventing raw objects
 * (e.g. FastAPI 422 validation arrays: {type, loc, msg, input, ctx})
 * from ever being rendered directly in React JSX children.
 */

interface FastApiValidationErrorItem {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

/**
 * Cleanly format a field location path like ["body", "warehouse_id"] into "warehouse_id".
 */
function formatFieldLocation(loc?: Array<string | number>): string {
  if (!loc || !Array.isArray(loc) || loc.length === 0) {
    return 'Field';
  }
  // Filter out top-level markers like "body", "query", "path"
  const relevantParts = loc.filter((part) => part !== 'body' && part !== 'query' && part !== 'path');
  if (relevantParts.length > 0) {
    return relevantParts.join('.');
  }
  return loc.join('.');
}

/**
 * Formats a FastAPI validation error item into a readable sentence.
 * e.g. "warehouse_id: Field required."
 */
function formatValidationItem(item: FastApiValidationErrorItem): string {
  if (!item || typeof item !== 'object') {
    return 'Invalid request parameter.';
  }

  const field = formatFieldLocation(item.loc);
  const rawMsg = item.msg || 'Invalid value.';
  const cleanMsg = rawMsg.endsWith('.') ? rawMsg : `${rawMsg}.`;

  if (field && field !== 'Field') {
    return `Invalid field ${field}: ${cleanMsg}`;
  }
  return cleanMsg;
}

/**
 * Safely extracts a single human-readable error string from any error type.
 *
 * @param error The unknown caught error (AxiosError, Error, string, or object)
 * @param fallbackMessage Default message to display if no specific details can be parsed
 * @returns A safe, friendly string suitable for rendering directly in JSX
 */
export function formatApiError(
  error: unknown,
  fallbackMessage: string = 'An unexpected error occurred. Please try again.'
): string {
  if (!error) {
    return fallbackMessage;
  }

  // 1. Primitive string error
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : fallbackMessage;
  }

  // 2. Axios or HTTP response error structure
  if (typeof error === 'object') {
    const maybeAxios = error as {
      response?: {
        status?: number;
        data?: {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        };
      };
      message?: string;
      code?: string;
    };

    if (maybeAxios.response) {
      const status = maybeAxios.response.status;
      const data = maybeAxios.response.data;

      // Check HTTP 422 Unprocessable Content (FastAPI validation)
      if (status === 422 && data) {
        const detail = data.detail;

        // FastAPI returns an array of validation items: [{type, loc, msg, input, ctx}]
        if (Array.isArray(detail) && detail.length > 0) {
          const formattedItems = detail
            .map((item) => {
              if (item && typeof item === 'object') {
                return formatValidationItem(item as FastApiValidationErrorItem);
              }
              return String(item);
            })
            .filter((msg) => msg.trim().length > 0);

          if (formattedItems.length > 0) {
            return formattedItems.join(' ');
          }
        }

        if (typeof detail === 'string' && detail.trim().length > 0) {
          return detail.trim();
        }

        return 'Validation error: Please review the form fields and correct invalid entries.';
      }

      // Check HTTP 400 Bad Request
      if (status === 400 && data) {
        if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
          return data.detail.trim();
        }
        if (typeof data.message === 'string' && data.message.trim().length > 0) {
          return data.message.trim();
        }
        return 'Bad request. Please verify the submitted data.';
      }

      // Check HTTP 401 Unauthorized
      if (status === 401) {
        return 'Authentication required. Your session may have expired; please sign in again.';
      }

      // Check HTTP 403 Forbidden
      if (status === 403) {
        return 'Access denied. You do not have permission to perform this operation.';
      }

      // Check HTTP 404 Not Found
      if (status === 404 && data) {
        if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
          return data.detail.trim();
        }
        return 'The requested resource was not found on the server.';
      }

      // Check HTTP 409 Conflict
      if (status === 409 && data) {
        if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
          return data.detail.trim();
        }
        return 'A data conflict occurred. The record or SKU may already exist.';
      }

      // Check HTTP 500 & 503 Internal Server Error
      if (status && status >= 500) {
        return 'Server error: The supply chain intelligence core is currently unavailable. Please retry in a moment.';
      }

      // Generic string detail or message in response body
      if (data) {
        if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
          return data.detail.trim();
        }
        if (typeof data.message === 'string' && data.message.trim().length > 0) {
          return data.message.trim();
        }
        if (typeof data.error === 'string' && data.error.trim().length > 0) {
          return data.error.trim();
        }
      }
    }

    // Network & Timeout Errors (Axios)
    if (maybeAxios.code === 'ECONNABORTED' || (maybeAxios.message && maybeAxios.message.toLowerCase().includes('timeout'))) {
      return 'The server request timed out after 20 seconds. Please check database connectivity and retry.';
    }

    if (maybeAxios.message && maybeAxios.message.toLowerCase().includes('network error')) {
      return 'Network error: Unable to connect to the backend server. Please verify the service is running.';
    }

    // Standard Error object
    if (error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message.trim();
    }
  }

  return fallbackMessage;
}

/**
 * Extracts a map of field name -> error message from a FastAPI 422 error response.
 * Useful for highlighting specific invalid input inputs in form modals.
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (!error || typeof error !== 'object') {
    return result;
  }

  const maybeAxios = error as {
    response?: {
      status?: number;
      data?: {
        detail?: unknown;
      };
    };
  };

  if (maybeAxios.response?.status === 422 && Array.isArray(maybeAxios.response.data?.detail)) {
    for (const item of maybeAxios.response.data.detail) {
      if (item && typeof item === 'object') {
        const valItem = item as FastApiValidationErrorItem;
        const fieldName = formatFieldLocation(valItem.loc);
        if (fieldName && valItem.msg) {
          result[fieldName] = valItem.msg;
        }
      }
    }
  }

  return result;
}
