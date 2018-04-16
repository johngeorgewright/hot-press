/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import chai from 'chai'
import HotPress from '../src/hot-press'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import functions from 'lodash.functions'

chai.use(sinonChai)
chai.should()

let broker

setup(() => {
  broker = new HotPress()
})

suite('emit()', () => {
  test('it returns a promise', () => {
    broker.emit('e').should.be.instanceof(Promise)
  })

  test('it resolves once all subscribers have resolved', () => {
    let spy = sinon.spy()
    let resolve = () => new Promise(resolve => {
      spy()
      resolve()
    })
    broker.on('e', resolve)
    broker.before('e', resolve)
    broker.after('e', resolve)
    return broker.emit('e').then(() => spy.should.have.been.calledThrice)
  })
})

suite('on()', () => {
  test('subscribes to events', () => {
    let spy = sinon.spy()
    broker.on('e', spy)
    return broker.emit('e').then(() => spy.should.have.been.calledOnce)
  })

  test('gives the message name and any data', () => {
    broker.on('e', (message, ...data) => {
      message.should.equal('e')
      data.should.eql([{mung: 'face'}, {some: 'thing'}])
    })
    return broker.emit('e', {mung: 'face'}, {some: 'thing'})
  })

  test('wildcards', () => {
    let spy = sinon.spy()
    broker.on('*', spy)
    return broker.emit('e')
      .then(() => spy.should.have.been.calledWith('e'))
      .then(() => broker.emit('f'))
      .then(() => spy.should.have.been.calledWith('f'))
      .then(() => broker.off('*'))
  })

  test('wildcards in hierarchy', () => {
    let spy = sinon.spy()
    broker.on('e.*', spy)
    return broker.emit('e.f')
      .then(() => spy.should.have.been.calledWith('e.f'))
      .then(() => broker.emit('e.f.g'))
      .then(() => spy.should.have.been.calledWith('e.f.g'))
      .then(() => broker.off('e.*'))
  })

  test('error handling', () => {
    let spy = sinon.spy()
    let error = new Error('should be swallowed')
    broker.on('e', () => {
      throw error
    })
    broker.on('error.e', spy)
    return broker
      .emit('e')
      .then(() => spy.should.have.been.calledOnce)
      .then(() => spy.should.have.been.calledWithExactly('error.e', error))
      .then(() => broker.off('error.e'))
  })
})

suite('all()', () => {
  let spy

  setup(() => {
    spy = sinon.spy()
    broker.all({before: ['e4'], on: ['e', 'e1', 'e2'], after: ['e3']}, spy)
  })

  test('is called once all events have been published', () =>
    broker.emit('e')
      .then(() => broker.emit('e1'))
      .then(() => spy.should.not.have.been.called)
      .then(() => broker.emit('e1'))
      .then(() => spy.should.not.have.been.called)
      .then(() => broker.emit('e2'))
      .then(() => spy.should.not.have.been.called)
      .then(() => broker.emit('e3'))
      .then(() => spy.should.not.have.been.called)
      .then(() => broker.emit('e4'))
      .then(() => spy.should.have.been.calledOnce)
  )

  test('that the data and event names have been passed to the subscriber', () =>
    Promise.all([
      broker.emit('e', 1, 2),
      broker.emit('e1', 3, 4),
      broker.emit('e2', 5, 6, 7),
      broker.emit('e3', 8),
      broker.emit('e4', 9, 10)
    ]).then(() => {
      spy.should.have.been.calledWith({
        e: [1, 2],
        e1: [3, 4],
        e2: [5, 6, 7],
        e3: [8],
        e4: [9, 10]
      })
    })
  )
})

suite('off()', () => {
  let spyA
  let spyB

  setup(() => {
    spyA = sinon.spy()
    spyB = sinon.spy()
    broker.on('e', spyA)
    broker.on('e', spyB)
  })

  test('unsubscribes a specific listener', () => {
    broker.off('e', spyA)
    return broker.emit('e').then(() => {
      spyA.should.not.have.been.called
      spyB.should.have.been.calledOnce
    })
  })

  test('unsubscribes all listeners', () => {
    broker.off('e')
    return broker.emit('e').then(() => {
      spyA.should.not.have.been.called
      spyB.should.not.have.been.called
    })
  })

  test('returns the amount listeners removed', () => {
    broker.off('e').should.equal(2)
    broker.off('e').should.equal(0)
  })

  test('we can add the same listener back again', () => {
    broker.off('e')
    broker.on('e', spyA)
    return broker.emit('e').then(() => {
      spyA.should.have.been.calledOnce
    })
  })
})

suite('once()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy()
    broker.once('e', spy)
    return Promise.all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('before()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions('before'))

  test('pauses other events', testBeforePause('before'))

  test('timeouts for long processes', testBeforeTimeout('before'))

  test('many subscribers', () => {
    let spy = sinon.spy()
    broker.before('e', spy)
    broker.before('e', spy)
    return broker.emit('e').then(() => spy.should.have.been.calledTwice)
  })
})

suite('onceBefore()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions('onceBefore'))

  test('pauses other events', testBeforePause('onceBefore'))

  test('it will only subscribe to the first event', () => {
    let spy = sinon.spy()
    broker.onceBefore('e', spy)
    return Promise
      .all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('after()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions('after'))
})

suite('onceAfter()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions('onceAfter'))

  test('subscribes only to the first event', () => {
    let spy = sinon.spy()
    broker.onceAfter('e', spy)
    return Promise
      .all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('triggers()', () => {
  test('the array of events are triggered by another event', () => {
    let spyA = sinon.spy()
    let spyB = sinon.spy()
    broker.on('e1', spyA)
    broker.on('e1', spyB)
    broker.on('e2', spyA)
    broker.on('e2', spyB)
    broker.triggers('e', ['e1', 'e2'])
    return broker.emit('e').then(() => {
      spyA.should.have.been.calledTwice
      spyB.should.have.been.calledTwice
    })
  })

  test('the data is passed from the trigger to the tiggered', () => {
    let spy = sinon.spy()
    broker.on('e1', spy)
    broker.triggers('e', ['e1'])
    return broker.emit('e', 'foo', 'bar').then(() => {
      spy.should.have.been.calledWith('e1', 'foo', 'bar')
    })
  })
})

suite('triggersAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    broker.on('e1', spy)
    broker.triggersAfter(message, ['e1'])
  }))
})

suite('triggersBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    broker.on('e1', spy)
    broker.triggersBefore(message, ['e1'])
  }))

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    broker.on('e1', wait)
    broker.triggersBefore(message, ['e1'])
  }))
})

suite('triggersOnce()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy()
    broker.on('e1', spy)
    broker.triggersOnce('e', ['e1'])
    return Promise.all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('triggersOnceBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    broker.on('e1', spy)
    broker.triggersOnceBefore(message, ['e1'])
  }))

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    broker.on('e1', wait)
    broker.triggersOnceBefore(message, ['e1'])
  }))

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy()
    broker.on('e1', spy)
    broker.triggersOnceBefore('e', ['e1'])
    return Promise.all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('triggersOnceAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    broker.on('e1', spy)
    broker.triggersOnceAfter(message, ['e1'])
  }))

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy()
    broker.on('e1', spy)
    broker.triggersOnceAfter('e', ['e1'])
    return Promise.all([broker.emit('e'), broker.emit('e')])
      .then(() => spy.should.have.been.calledOnce)
  })
})

suite('ns()', () => {
  let spy
  let foo

  setup(() => {
    spy = sinon.spy()
    foo = broker.ns('foo')
  })

  test('it returns an object with all required methods', () => {
    foo.should.be.an('object')
    functions(broker)
      .filter(fn => !/HotPress[a-zA-Z]*Error/.test(fn))
      .forEach(name => foo.should.respondTo(name))
  })

  test('it decorates the `on` method with your namespace', () => {
    foo.on('bar', spy)
    return broker
      .emit('foo.bar')
      .then(() => foo.emit('bar'))
      .then(() => spy.should.have.been.calledTwice)
  })

  test('it decorates trigger methods', () => {
    foo.on('bar', spy)
    foo.triggers('boo', ['bar'])
    return broker
      .emit('foo.boo')
      .then(() => spy.should.have.been.calledOnce)
  })

  test('it is basically a singleton factory', () => {
    foo.should.equal(broker.ns('foo'), 'Objects are not exactly the same')
    foo.ns('bar').should.equal(broker.ns('foo.bar'))
  })

  test('properties cascade on creation of a new namespace', () => {
    foo.timeout = 500
    foo.lifecycle = ['mung', 'on', 'face']
    let zob = foo.ns('zob')
    zob.timeout.should.equal(500)
    zob.lifecycle.should.eql(['mung', 'on', 'face'])
  })
})

suite('reg()', () => {
  setup(() => {
    broker.reg('proc', () => {})
  })

  test('it will only allow one procedure per name', () => {
    let incorrect = () => broker.reg('proc', () => {})
    incorrect.should.throw('The procedure "proc" is already registered')
  })
})

suite('dereg()', () => {
  let spy

  setup(() => {
    spy = sinon.spy()
    broker.reg('procedure', spy)
  })

  test('the process is unregistered', () => {
    broker.dereg('procedure')
    return broker.call('procedure').catch(error => {
      error.message.should.equal('The procedure "procedure" doesn\'t exist')
    })
  })

  test('the return value represents the amount of processes removed', () => {
    broker.dereg('procedure').should.equal(1)
    broker.dereg('foo').should.equal(0)
  })
})

suite('deregAll()', () => {
  let spy

  setup(() => {
    spy = sinon.spy()
    broker.reg('procedure1', spy)
    broker.reg('procedure2', spy)
  })

  test('it will remove all registered procedures', () => {
    broker.deregAll()
    return broker.call('procedure1')
      .catch(() => {})
      .then(() => broker.call('procedure2'))
      .catch(() => {})
      .then(() => spy.should.not.have.been.called)
  })

  test('returns the amount of procedures removed', () => {
    broker.deregAll().should.equal(2)
  })
})

suite('call()', () => {
  let spy

  setup(() => {
    spy = sinon.stub().returns('YAY')
    broker.reg('proc', spy)
  })

  test('returns a Promise', () => {
    broker.call('proc').should.be.instanceOf(Promise)
  })

  test('the process is called', () => {
    let data = ['i', 'am', 'data']
    return broker.call('proc', data).then(() => {
      spy.should.have.been.calledOnce
      spy.should.have.been.calledWithExactly(data)
    })
  })

  test('the result is given back', () => {
    return broker.call('proc').then(data => data.should.equal('YAY'))
  })

  test('an event lifecycle is triggered', done => {
    broker.before('proc', spy)
    broker.on('proc', spy)
    broker.after('proc', result => done())
    broker.call('proc').then(() => spy.callCount.should.equal(3))
  })
})

suite('custom lifecycles', () => {
  test('methods are added', () => {
    broker.lifecycle = ['foo', 'bar', 'on', 'zob']
    broker.should.not.respondTo('before')
    broker.should.not.respondTo('after')
    broker.should.respondTo('foo')
    broker.should.respondTo('bar')
    broker.should.respondTo('zob')
  })

  test('lifecycles can\'t contain duplicates', () => {
    (() => {
      broker.lifecycle = ['foo', 'foo', 'on']
    })
      .should.throw('Lifecycle contains duplicates (foo)')
  })

  test('lifecycles must contain an "on" keywords', () => {
    (() => {
      broker.lifecycle = ['foo', 'bar', 'zob']
    })
      .should.throw('Lifecycle (foo,bar,zob) must contain an "on" method')
  })
})

function testBeforePause (method) {
  return done => {
    method = typeof method === 'string' ? broker[method] : method
    let spy = sinon.spy()
    broker.on('e', spy)
    method('e', () => new Promise(resolve => setTimeout(resolve, 100)))
    broker.emit('e')
    setTimeout(() => spy.should.not.have.been.called, 90)
    setTimeout(() => {
      spy.should.have.been.calledOnce
      done()
    }, 110)
  }
}

function testBeforeTimeout (method) {
  return () => {
    method = typeof method === 'string' ? broker[method] : method
    let spyA = sinon.spy()
    let spyB = sinon.spy()
    broker.after('e', spyA)
    broker.on('error.e', spyB)
    method('e', () => new Promise(resolve => setTimeout(resolve, broker.timeout + 5)))
    return broker.emit('e').then(() => {
      spyA.should.have.been.calledOnce
      spyB.should.have.been.calledOnce
      let error = spyB.firstCall.args[1]
      error.should.be.instanceOf(Error)
      error.should.have.property('message', `Exceeded ${broker.timeout}ms`)
    })
  }
}

function testBeforeSubscriptions (method) {
  return () => {
    method = typeof method === 'string' ? broker[method] : method
    let spyA = sinon.spy()
    let spyB = sinon.spy()
    broker.on('e', spyA)
    method('e', spyB)
    return broker.emit('e').then(() => spyB.should.have.been.calledBefore(spyA))
  }
}

function testAfterSubscriptions (method) {
  return () => {
    method = typeof method === 'string' ? broker[method] : method
    let spyA = sinon.spy()
    let spyB = sinon.spy()
    method('e', spyA)
    broker.on('e', spyB)
    return broker.emit('e').then(() => {
      spyA.should.have.been.calledOnce
      spyB.should.have.been.calledOnce
      spyA.should.have.been.calledAfter(spyB)
    })
  }
}
