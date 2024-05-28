import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: 'src/api/type-defs/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        maybeValue: 'T', // Disable making everything nullable, https://github.com/dotansimha/graphql-code-generator/issues/3919#issuecomment-618595537
      },
    },
  },
};

export default config;
