// https://github.com/mixmaxhq/mongo-cursor-pagination
declare module 'mongo-cursor-pagination' {
  import { Collection } from 'mongoose';
  import { Pagination } from './api/db/models/Task.ts';

  interface AggregationInput extends Pagination {}
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

declare module 'mongodb-query-parser' {
  // NOTE: Copied manually from node_modules/mongodb-query-parser/dist/index.d.ts,
  // not sure why TS is not picking it up automatically
  export declare function stringify(obj: unknown): string | undefined;
  export declare function toJSString(
    obj: unknown,
    ind?: Parameters<typeof JSON.stringify>[2],
  ): string | undefined;
  declare const DEFAULT_FILTER: {};
  declare const DEFAULT_SORT: null;
  declare const DEFAULT_LIMIT = 0;
  declare const DEFAULT_SKIP = 0;
  declare const DEFAULT_PROJECT: null;
  declare const DEFAULT_COLLATION: null;
  declare const DEFAULT_MAX_TIME_MS = 60000;
  declare const QUERY_PROPERTIES: string[];
  export declare function parseSort(input: string): any;
  export declare function parseFilter(input: string): any;
  export declare function parseCollation(input: string): any;
  export declare function isFilterValid(input: string): any;
  export declare function isCollationValid(input: string): any;
  export declare function parseProject(input: string): any;
  export declare function isProjectValid(input: string): false | object | null;
  export declare function isSortValid(input: string): false | object | null;
  export declare function isMaxTimeMSValid(input: string | number): number | false;
  export declare function isSkipValid(input: string | number): number | false;
  export declare function isLimitValid(input: string | number): number | false;
  export declare function validate(what: string, input: string): any;
  export default function queryParser(filter: string, project?: string | null): any;
  export {
    stringify,
    toJSString,
    QUERY_PROPERTIES,
    DEFAULT_FILTER,
    DEFAULT_SORT,
    DEFAULT_LIMIT,
    DEFAULT_SKIP,
    DEFAULT_PROJECT,
    DEFAULT_COLLATION,
    DEFAULT_MAX_TIME_MS,
  };
}

declare module 'random-hex-color';
