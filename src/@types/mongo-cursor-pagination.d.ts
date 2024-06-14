declare module 'mongo-cursor-pagination' {
  import { Model } from 'mongoose';

  export type AggregationInput = {
    aggregation: Array<{
      $match: Record<string, any>;
      $set?: Record<string, any>;
    }>;
    paginatedField?: string;
    sortAscending?: boolean;
    limit?: number;
    next?: string;
    previous?: string;
  };
  export interface AggregationOutput<T> {
    metadata: {
      total: number;
      page: number;
    }[];
    results: T[];
  }

  const defaultExport: {
    mongoosePlugin: any;
    aggregate: <T extends Model>(
      model: T['schema'],
      input: AggregationInput,
    ) => AggregationOutput<T>;
  };
  export default defaultExport;
}
