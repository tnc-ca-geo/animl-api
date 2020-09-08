module.exports = `
  input ImageInput {
    hash: String!
    filePath: String!
    bucket: String!
    objectKey: String!
    originalFileName: String
    dateTimeOriginal: Date!,
    imageWidth: Int
    imageHeight: Int
    mimeType: String

    # Camera
    make: String
    serialNumber: String!
    model: String

    # User Set Data
    comment: String
    userLabel: String

    # Location
    GPSLatitude: String
    GPSLongitude: String
    GPSAltitude: String
}`;


// TODO: add the following: 

// userSetData: { type: Map, of: String },
// location: { type: shared.LocationSchema },
// labels: { type: [LabelSchema] },