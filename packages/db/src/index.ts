import { Pool } from 'pg';

export const createPool = (connectionString: string) => {
  return new Pool({ connectionString });
};
