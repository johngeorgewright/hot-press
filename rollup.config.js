import resolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'

export default {
  input: 'src/hot-press.js',
  output: {
    file: 'dist/hot-press.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    babel({
      babelrc: false,
      exclude: 'node_modules/**',
      plugins: [
        '@babel/plugin-syntax-dynamic-import',
        '@babel/plugin-syntax-import-meta',
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-proposal-json-strings'
      ],
      presets: [
        ['@babel/preset-env', {
          'modules': false,
          'targets': {
            'browsers': [
              'ie >= 9'
            ]
          }
        }]
      ]
    })
  ]
}
