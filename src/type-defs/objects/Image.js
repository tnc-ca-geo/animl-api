module.exports = `
  type Image {
    _id: ID!
    hash: String!
    bucket: String!
    objectKey: String!
    dateAdded: Date!
    dateTimeOriginal: Date!
    originalFileName: String
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