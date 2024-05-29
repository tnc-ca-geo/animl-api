# Notes

## TODOs

- [ ] Remove date casting
- [ ] Remove KLUDGE fixes

## To Verify

- `@roleCheck` properly enforces permissions
- `Query.imageErrors` fix is correct to call `context.models.ImageError.countImageErrors(input.filters)` rather than [`context.models.ImageError.countImageErrors(input)`]()
- `Mutation.createUser` & `Mutation.updateUser` was previously calling `User.create`/`User.update`, should actually call [`User.createUser`/`User.updateUser`](https://github.com/tnc-ca-geo/animl-api/blob/9949803dea5d237c136c2e70ad8861ad7fac9797/src/api/db/models/User.js#L225-236)
- `Query.task` was previously calling a bad method
- `Query.users` was previously calling a bad method

## To Discuss

- Consider using [`@graphql-codegen/typescript-mongodb`](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-mongodb#what-this-plugin-does) to remove need for schema interfaces