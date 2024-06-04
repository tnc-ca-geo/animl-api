export default /* GraphQL */ `
  type PageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
  }

  type PageCount {
    count: Int
  }

  union PageInfoWithCount = PageInfo | PageCount
`;

// TODO: should any of these be required?
