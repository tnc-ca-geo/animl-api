declare module 'mongo-cursor-pagination' {
  import { Model, PipelineStage } from 'mongoose';

  type Maybe<T> = T | null;

  export type AggregationInput = {
    aggregation: PipelineStage[];
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
