module.exports = `
  type Image {
    _id: ID!
    hash: String!
    filePath: String!
    bucket: String!
    objectKey: String!
    originalFileName: String
    dateAdded: Date!
    dateTimeOriginal: Date!
    imageWidth: Int
    imageHeight: Int
    mimeType: String
    camera: Camera!
    userSetData: JSONObject
    location: Location
  }`;


// TODO: add the following: 
// location: { type: shared.LocationSchema },
// labels: { type: [LabelSchema] },