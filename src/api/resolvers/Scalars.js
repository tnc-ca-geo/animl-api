const { DateTime } = require('luxon');
const { GraphQLScalarType } = require('graphql');
const GraphQLJSON = require('graphql-type-json');
const JSONObject = GraphQLJSON.GraphQLJSONObject;
const { localConfig } = require('../../config/config');

// Good explanation of the difference between
// parseValue(), serialize(), and parseLiteral() here:
// https://stackoverflow.com/questions/41510880/whats-the-difference-between-parsevalue-and-parseliteral-in-graphqlscalartype

const Date = new GraphQLScalarType({
    name: 'Date',
    description: 'Date scalar type',
    // Parse input when the type of input is JSON
    // e.g. input is passed into query as a JSON variable
    parseValue(value) {
        return DateTime.fromFormat(value, localConfig.TIME_FORMATS.EXIF);
    },
    // Prep return value to be sent to client
    serialize(value) {
        // previously, we used value.getTime() and returned dates as UNIX timestamps
        // however, for consistency and to make sure that if those dates get sent
        // back to the API they get parsed correctly by parseValue(),
        // let's serialize all external dates in EXIF format

        // TODO: is this worth revisiting? Perhaps convert all EXIF dates to
        // ISO 8601 in animl-ingest and use ISO outside of animl-api instead
        // of EXIF format?

        const dt = DateTime.fromJSDate(value);
        return dt.toFormat(localConfig.TIME_FORMATS.EXIF);
    },
    // Parse input when the type of input is "inline" (AST)
    parseLiteral(ast) {
        return DateTime.fromFormat(ast.value, localConfig.TIME_FORMATS.EXIF);
    }
});

module.exports = {
    JSONObject,
    Date
};

