module.exports = `
  input AutomationEventInput {
    type: String!
    label: String
  }

  input AutomationActionInput {
    type: String!
    model: ID,
    alertRecipients: [String],
  }

  input AutomationRuleInput {
    _id: ID
    name: String!
    event: AutomationEventInput!
    action: AutomationActionInput!
  }

  input ViewDiffsInput {
    name: String
    description: String
    filters: FiltersInput
    automationRules: [AutomationRuleInput]
  }

  input UpdateViewInput {
    _id: ID!
    diffs: ViewDiffsInput!
}`;

// TODO: in CreateLabelsInput and UpdateObjectsInput, we use imageId: ID! 
// to id the image. Might want to do that here too for consistency?
// but call it viewId of course