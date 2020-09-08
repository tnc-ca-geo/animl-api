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
}`;


// TODO: add the following: 

// userSetData: { type: Map, of: String },

// camera: { type: shared.CameraSchema, required: true },
// location: { type: shared.LocationSchema },
// labels: { type: [LabelSchema] },