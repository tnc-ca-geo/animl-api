declare module 'mongo-cursor-pagination' {
  import { Collection } from 'mongoose';

  type Maybe<T> = T | null;

  export type AggregationInput = {
    aggregation: Array<{
      $match: Record<string, any>;
      $set?: Record<string, any>;
    }>;
    paginatedField?: Maybe<string>;
    sortAscending?: Maybe<boolean>;
    limit?: Maybe<number>;
    next?: Maybe<string>;
    previous?: Maybe<string>;
  };

  export interface AggregationOutput<T> {
    metadata: Array<{
      total: number;
      page: number;
    }>;
    results: T[];
    data: T[];
  }

  const defaultExport: {
    mongoosePlugin: any;
    aggregate: <T extends Collection, Output = AggregationOutput<T>>(
      model: T,
      input: AggregationInput,
    ) => Output;
  };
  export default defaultExport;
}
