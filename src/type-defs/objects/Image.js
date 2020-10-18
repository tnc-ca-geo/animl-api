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
    cameraSn: String!
    camera: Camera
    make: String!
    model: String,
    userSetData: JSONObject
    location: Location
    labels: [Labels]
  }`;

// TODO: add the following: 
// location: { type: shared.LocationSchema },

// TODO: decide if we want to populate() cameraSn field when returning 
// an Image - in which case I think we use cameraSn: Camera!
