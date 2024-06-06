// https://github.com/mixmaxhq/mongo-cursor-pagination
declare module 'mongo-cursor-pagination' {
  import { Collection } from 'mongoose';

  interface AggregationInput extends Pagination {}
  export interface AggregationOutput<T> extends PageInfo {
    paginatedField: string;
    sortAscending: boolean;
    limit: number;

    previous: string;
    hasPrevious: boolean;
    next: string;
    hasNext: boolean;

    results: T;
  }

  const defaultExport: {
    mongoosePlugin: any;
    aggregate: <T>(model: Collection, input: AggregationInput) => AggregationOutput<T>;
  };
  export default defaultExport;
}
