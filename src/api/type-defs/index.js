const fs = require('fs');
const path = require('path');

const typeDefStrings = [];
for (const entry_top of fs.readdirSync(path.resolve(__dirname))) {
    if (!fs.lstatSync(path.resolve(__dirname, entry_top)).isDirectory()) continue;

    for (const entry_sub of fs.readdirSync(path.resolve(__dirname, entry_top))) {
        const full = path.resolve(__dirname, entry_top, entry_sub);
        if (!fs.lstatSync(full).isFile()) continue;
        if (path.parse(full).ext !== '.js') continue;

        typeDefStrings.push(require(path.resolve(__dirname, entry_top, entry_sub)));
    }
}

// TODO: follow shopify naming convention for type-defs & resolvers:
// 'ImageCreateInput' rather than 'CreateImageInput' for alphabetical grouping
// by DB collection/schema type

module.exports = typeDefStrings.join('');
