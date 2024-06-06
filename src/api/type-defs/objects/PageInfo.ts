export default /* GraphQL */ `
  type PageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
  }

  type PageInfoWithCount implements PageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
    count: Int
  }
`;

// TODO: should any of these be required?
