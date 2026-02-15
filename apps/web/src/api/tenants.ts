import { apiFetch } from './client';

export const tenantsApi = {
  create: (payload: { name: string }) =>
    apiFetch<{ tenantId: string }>('/tenants', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};
