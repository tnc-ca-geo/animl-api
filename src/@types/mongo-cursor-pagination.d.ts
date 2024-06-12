declare module 'mongo-cursor-pagination' {
  import { Collection } from 'mongoose';

  export type AggregationInput<T = {}> = T & {
    paginatedField: string;
    sortAscending: boolean;
    limit: number;
    next: string;
    previous: string;
  };

  export interface AggregationOutput<T> {
    metadata: {
      total: number;
      page: number;
    }[];
    data: T[];
  }

  const defaultExport: {
    mongoosePlugin: any;
    aggregate: <T extends Collection>(model: T, input: AggregationInput) => AggregationOutput<T>;
  };
  export default defaultExport;
}
