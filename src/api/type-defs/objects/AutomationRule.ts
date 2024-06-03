export default /* GraphQL */ `
  type AutomationEvent {
    type: String!
    label: String
  }

  type AutomationAction {
    type: String!
    alertRecipients: [String]
    mlModel: String
    confThreshold: Float
    categoryConfig: JSONObject
  }

  type AutomationRule {
    _id: ID!
    name: String!
    event: AutomationEvent!
    action: AutomationAction!
  }
`;
