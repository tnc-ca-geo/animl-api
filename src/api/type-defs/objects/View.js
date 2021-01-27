module.exports = `
  type View {
    _id: String!
    name: String!
    filters: Filters!
    description: String
    editable: Boolean!
    automationRules: [AutomationRule]
  }
`;
