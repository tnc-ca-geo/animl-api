import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './src/api/type-defs/**/*',
  generates: {
    './src/@types/graphql.ts': {
      plugins: ['typescript'],
    },
  },
};

export default config;
