import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './src/api/type-defs/**/*',
  generates: {
    './src/@types/graphql.ts': {
      plugins: [
        // Generate TypeScript types from the GraphQL schema
        'typescript',
        // Enable scalars customization
        'typescript-operations',
        // Import mongoose into the generated file
        {
          add: {
            content: 'import mongoose from "mongoose";\n',
          },
        },
      ],
      config: {
        // https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-operations#scalars
        scalars: {
          ID: {
            input: 'string',
            output: 'mongoose.Types.ObjectId | string',
          },
        },
      },
    },
  },
};

export default config;
