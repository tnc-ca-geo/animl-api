export default /* GraphQL */ `
  enum AggregationLevel {
    imageAndObject
    burst
    independentDetection
  }

  input QueryStatsInput {
    filters: FiltersInput!
    aggregationLevel: AggregationLevel!
    independenceInterval: Int
  }
`;
