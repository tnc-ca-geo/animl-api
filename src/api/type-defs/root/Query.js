module.exports = `
  type Query {
    projects(_ids: [String!]): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    labels: LabelList
    cameras(_ids: [String!]): [Camera]
    views(_ids: [String!]): [View]
    models(_ids: [String!]): [MLModel]
  }
`;

// TODO AUTH - we will no longer need to get query views once they are embedded 
// in projects. Maybe models too?

// TODO: rename models -> mlModels
