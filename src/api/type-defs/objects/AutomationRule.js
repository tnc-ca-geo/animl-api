module.exports = `
  type AutomationEvent {
    type: String!
    label: String
  }

  type AutomationAction {
    type: String!
    alertRecipients: [String]
    mlModel: String
    confThreshold: Number
    categoryConfig: JSONObject
  }

  type AutomationRule {
    _id: ID!
    name: String!
    event: AutomationEvent!
    action: AutomationAction!
  }
`;
