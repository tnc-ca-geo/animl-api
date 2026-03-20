export default /* GraphQL */ `
  input PlatformStatsHistoryInput {
    start: Date!
    end: Date!
    filter: PlatformStatsFilterInput
  }
`;
