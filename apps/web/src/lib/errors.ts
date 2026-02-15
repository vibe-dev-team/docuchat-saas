import type { ApiError } from '@/api/client';

const flattenZodErrors = (details: any) => {
  if (!details) return null;
  const error = details?.error ?? details;
  const formErrors = error?.formErrors ?? error?.form_errors;
  const fieldErrors = error?.fieldErrors ?? error?.field_errors;

  const messages: string[] = [];
  if (Array.isArray(formErrors)) {
    messages.push(...formErrors.filter(Boolean));
  }
  if (fieldErrors && typeof fieldErrors === 'object') {
    Object.values(fieldErrors).forEach((value) => {
      if (Array.isArray(value)) {
        messages.push(...value.filter(Boolean));
      }
    });
  }
  return messages.length ? messages.join(' ') : null;
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  const apiError = error as Partial<ApiError> & { details?: any };

  if (apiError.details) {
    if (typeof apiError.details === 'string') return apiError.details;
    if (typeof apiError.details?.error === 'string') return apiError.details.error;
    if (typeof apiError.details?.message === 'string') return apiError.details.message;
    const zod = flattenZodErrors(apiError.details);
    if (zod) return zod;
  }

  if (apiError.message) return apiError.message;
  return fallback;
};
