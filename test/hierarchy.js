/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import {getHierarchy, prependHierarchy, removePrefix} from '../src/hierarchy'
import chai from 'chai'

chai.should()

suite('hierarchy', () => {
  test('getHierarchy()', () => {
    getHierarchy('a.b.c.d').should.eql([
      'a.b.c.d',
      'a.b.c.*',
      'a.b.*',
      'a.*',
      '*'
    ])
  })

  test('prependHierarchy()', () => {
    prependHierarchy('a.b.c.d', 'X').should.equal('X.a.b.c.d')
    prependHierarchy('a.b.c.d').should.equal('a.b.c.d')
  })

  test('removePrefix()', () => {
    removePrefix('a.b.c.d', 'a').should.equal('b.c.d')
    removePrefix('a.b.c.d').should.equal('a.b.c.d')
  })
})
