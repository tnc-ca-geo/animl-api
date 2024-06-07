export default /* GraphQL */ `
  interface IPageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
  }
  
  type PageInfo implements IPageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
  }

  type PageInfoWithCount implements IPageInfo {
    previous: String
    hasPrevious: Boolean
    next: String
    hasNext: Boolean
    count: Int
  }
`;

// TODO: should any of these be required?
