module.exports = `
  input LabelDiffsInput {
    locked: Boolean
    validation: ValidationInput
  }

  input UpdateLabelInput {
    imageId: ID!
    objectId: ID!
    labelId: ID!
    diffs: LabelDiffsInput!
}`;