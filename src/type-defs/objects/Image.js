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
    cameraSn: Camera!
    make: String!
    model: String,
    userSetData: JSONObject
    location: Location
  }`;


// TODO: add the following: 
// location: { type: shared.LocationSchema },
// labels: { type: [LabelSchema] },