const hello = (_, { name }) => {
  console.log('hellooo: ', name);
  return `Hello ${name || 'World'}`;
};

module.exports = {
  hello
};
