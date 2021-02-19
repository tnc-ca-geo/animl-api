module.exports = `
  input AutomationEventInput {
    type: String!
    label: String
  }

  input AutomationActionInput {
    type: String!
    model: ID,
    alertRecipient: String,
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
