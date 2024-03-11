import fs from 'node:fs';
import path from 'node:path';

const typeDefStrings = [];
const base = new URL(path.parse(import.meta.url).dir).pathname;

for (const entry_top of fs.readdirSync(base)) {
  if (!fs.lstatSync(path.resolve(base, entry_top)).isDirectory()) continue;

  for (const entry_sub of fs.readdirSync(path.resolve(base, entry_top))) {
    const full = path.resolve(path.resolve(base, entry_top, entry_sub));
    if (!fs.lstatSync(full).isFile()) continue;
    if (path.parse(full).ext !== '.js') continue;

    typeDefStrings.push((await import(path.resolve(base, entry_top, entry_sub))).default);
  }
}

// TODO: follow shopify naming convention for type-defs & resolvers:
// 'ImageCreateInput' rather than 'CreateImageInput' for alphabetical grouping
// by DB collection/schema type

export default typeDefStrings.join('');
