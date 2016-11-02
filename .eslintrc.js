module.exports = {
  extends: 'google',
  'env': {
    'browser': true,
    'es6': true,
    'node': true
  },
  rules: {
    'arrow-parens': [1, 'as-needed'],
    'comma-dangle': [0],
    'guard-for-in': 'off',
    'operator-linebreak': ['warn', 'before'],
    'no-implicit-coercion': 'off',
    'no-use-before-define': 'off'
  }
};
