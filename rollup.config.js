import resolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'

export default {
  input: 'src/hot-press.js',
  output: {
    file: 'hot-press.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    babel({
      babelrc: false,
      exclude: 'node_modules/**',
      plugins: [
        'external-helpers'
      ],
      presets: [
        ['env', {
          'modules': false,
          'targets': {
            'browsers': [
              'ie >= 9'
            ]
          }
        }],
        'stage-3'
      ]
    })
  ]
}
