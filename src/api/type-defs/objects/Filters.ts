export default /* GraphQL */ `
  type Filters {
    cameras: [String!]
    deployments: [String!]
    labels: [String!]
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
    reviewed: Boolean
    notReviewed: Boolean
    custom: String
    comments: String
  }
`;
