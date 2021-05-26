module.exports = `
  type Image {
    _id: ID!
    bucket: String!
    fileTypeExtension: String!
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
    objects: [Object]
  }`;

// TODO: add the following: 
// location: { type: shared.LocationSchema },

// TODO: decide if we want to populate() cameraSn field when returning 
// an Image - in which case I think we use cameraSn: Camera!
