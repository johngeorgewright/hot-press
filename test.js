/* eslint-env mocha */
/* eslint max-len:off, require-jsdoc:off */

const chai = require('chai');
const HP = require('./hot-press.src.js');
const {
  after, all, before, call, dereg, deregAll, emit, off, on, once, onceAfter,
  onceBefore, reg, triggers, triggersAfter, triggersBefore, triggersOnce,
  triggersOnceAfter, triggersOnceBefore
} = HP;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const functions = require('lodash.functions');

chai.use(sinonChai);
chai.should();

teardown(() => {
  off('e');
  off('e1');
  off('e2');
});

suite('emit()', () => {
  test('it returns a promise', () => {
    emit('e').should.be.instanceof(Promise);
  });

  test('it resolves once all subscribers have resolved', () => {
    let spy = sinon.spy();
    let resolve = () => new Promise(resolve => {
      spy();
      resolve();
    });
    on('e', resolve);
    before('e', resolve);
    after('e', resolve);
    return emit('e').then(() => spy.should.have.been.calledThrice);
  });
});

suite('on()', () => {
  test('subscribes to events', () => {
    let spy = sinon.spy();
    on('e', spy);
    return emit('e').then(() => spy.should.have.been.calledOnce);
  });

  test('gives the message name and any data', () => {
    on('e', (message, ...data) => {
      message.should.equal('e');
      data.should.eql([{mung: 'face'}, {some: 'thing'}]);
    });
    return emit('e', {mung: 'face'}, {some: 'thing'});
  });

  test('wildcards', () => {
    let spy = sinon.spy();
    on('*', spy);
    return emit('e')
      .then(() => spy.should.have.been.calledWith('e'))
      .then(() => emit('f'))
      .then(() => spy.should.have.been.calledWith('f'))
      .then(() => off('*'));
  });

  test('wildcards in hierarchy', () => {
    let spy = sinon.spy();
    on('e.*', spy);
    return emit('e.f')
      .then(() => spy.should.have.been.calledWith('e.f'))
      .then(() => emit('e.f.g'))
      .then(() => spy.should.have.been.calledWith('e.f.g'))
      .then(() => off('e.*'));
  });

  test('error handling', () => {
    let spy = sinon.spy();
    let error = new Error('should be swallowed');
    on('e', () => {
      throw error;
    });
    on('error.e', spy);
    return HP
      .emit('e')
      .then(() => spy.should.have.been.calledOnce)
      .then(() => spy.should.have.been.calledWithExactly('error.e', error))
      .then(() => off('error.e'));
  });
});

suite('all()', () => {
  let spy;

  setup(() => {
    spy = sinon.spy();
    all({before: ['e4'], on: ['e', 'e1', 'e2'], after: ['e3']}, spy);
  });

  teardown(() => Promise.all([
    off('e1'),
    off('e2'),
    off('e3'),
    off('e4')
  ]));

  test('is called once all events have been published', () => (
    emit('e')
      .then(() => emit('e1'))
      .then(() => emit('e1'))
      .then(() => emit('e2'))
      .then(() => emit('e3'))
      .then(() => emit('e4'))
      .then(() => spy.should.have.been.calledOnce)
  ));

  test('that the data and event names have been passed to the subscriber', () => (
    Promise.all([
      emit('e', 1, 2),
      emit('e1', 3, 4),
      emit('e2', 5, 6, 7),
      emit('e3', 8),
      emit('e4', 9, 10)
    ]).then(() => {
      spy.should.have.been.calledWith({
        e: [1, 2],
        e1: [3, 4],
        e2: [5, 6, 7],
        e3: [8],
        e4: [9, 10]
      });
    })
  ));
});

suite('off()', () => {
  let spyA;
  let spyB;

  setup(() => {
    spyA = sinon.spy();
    spyB = sinon.spy();
    on('e', spyA);
    on('e', spyB);
  });

  test('unsubscribes a specific listener', () => {
    off('e', spyA);
    return emit('e').then(() => {
      spyA.should.not.have.been.called;
      spyB.should.have.been.calledOnce;
    });
  });

  test('unsubscribes all listeners', () => {
    off('e');
    return emit('e').then(() => {
      spyA.should.not.have.been.called;
      spyB.should.not.have.been.called;
    });
  });

  test('returns the amount listeners removed', () => {
    off('e').should.equal(2);
    off('e').should.equal(0);
  });

  test('we can add the same listener back again', () => {
    off('e');
    on('e', spyA);
    return emit('e').then(() => {
      spyA.should.have.been.calledOnce;
    });
  });
});

suite('once()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    once('e', spy);
    return Promise.all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('before()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions(before));

  test('pauses other events', testBeforePause(before));

  test('timeouts for long processes', testBeforeTimeout(before));

  test('many subscribers', () => {
    let spy = sinon.spy();
    before('e', spy);
    before('e', spy);
    return emit('e').then(() => spy.should.have.been.calledTwice);
  });
});

suite('onceBefore()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions(onceBefore));

  test('pauses other events', testBeforePause(onceBefore));

  test('it will only subscribe to the first event', () => {
    let spy = sinon.spy();
    onceBefore('e', spy);
    return Promise
      .all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('after()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions(after));
});

suite('onceAfter()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions(onceAfter));

  test('subscribes only to the first event', () => {
    let spy = sinon.spy();
    onceAfter('e', spy);
    return Promise
      .all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggers()', () => {
  teardown(() => {
    off('e1');
    off('e2');
  });

  test('the array of events are triggered by another event', () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    on('e1', spyA);
    on('e1', spyB);
    on('e2', spyA);
    on('e2', spyB);
    triggers('e', ['e1', 'e2']);
    return emit('e').then(() => {
      spyA.should.have.been.calledTwice;
      spyB.should.have.been.calledTwice;
    });
  });

  test('the data is passed from the trigger to the tiggered', () => {
    let spy = sinon.spy();
    on('e1', spy);
    triggers('e', ['e1']);
    return emit('e', 'foo', 'bar').then(() => {
      spy.should.have.been.calledWith('e1', 'foo', 'bar');
    });
  });
});

suite('triggersAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    on('e1', spy);
    triggersAfter(message, ['e1']);
  }));
});

suite('triggersBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    on('e1', spy);
    triggersBefore(message, ['e1']);
  }));

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    on('e1', wait);
    triggersBefore(message, ['e1']);
  }));
});

suite('triggersOnce()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    on('e1', spy);
    triggersOnce('e', ['e1']);
    return Promise.all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggersOnceBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    on('e1', spy);
    triggersOnceBefore(message, ['e1']);
  }));

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    on('e1', wait);
    triggersOnceBefore(message, ['e1']);
  }));

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    on('e1', spy);
    triggersOnceBefore('e', ['e1']);
    return Promise.all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggersOnceAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    on('e1', spy);
    triggersOnceAfter(message, ['e1']);
  }));

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    on('e1', spy);
    triggersOnceAfter('e', ['e1']);
    return Promise.all([emit('e'), emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('ns()', () => {
  let spy;
  let foo;

  setup(() => {
    spy = sinon.spy();
    foo = HP.ns('foo');
  });

  test('it returns an object with all required methods', () => {
    foo.should.be.an('object');
    functions(HP)
      .filter(fn => !/HotPress[a-zA-Z]*Error/.test(fn))
      .forEach(name => foo.should.respondTo(name));
  });

  test('it decorates the `on` method with your namespace', () => {
    foo.on('bar', spy);
    return HP
      .emit('foo.bar')
      .then(() => foo.emit('bar'))
      .then(() => spy.should.have.been.calledTwice);
  });

  test('it decorates trigger methods', () => {
    foo.on('bar', spy);
    foo.triggers('boo', ['bar']);
    return HP
      .emit('foo.boo')
      .then(() => spy.should.have.been.calledOnce);
  });

  test('it is basically a singleton factory', () => {
    foo.should.equal(HP.ns('foo'), 'Objects are not exactly the same');
    foo.ns('bar').should.equal(HP.ns('foo.bar'));
  });

  test('properties cascade on creation of a new namespace', () => {
    foo.timeout = 500;
    foo.lifecycle = ['mung', 'on', 'face'];
    let zob = foo.ns('zob');
    zob.timeout.should.equal(500);
    zob.lifecycle.should.eql(['mung', 'on', 'face']);
  });
});

suite('reg()', () => {
  setup(() => {
    reg('proc', () => {});
  });

  teardown(() => {
    dereg('proc');
  });

  test('it will only allow one procedure per name', () => {
    let incorrect = () => reg('proc', () => {});
    incorrect.should.throw('The procedure "proc" is already registered');
  });
});

suite('dereg()', () => {
  let spy;

  setup(() => {
    spy = sinon.spy();
    reg('procedure', spy);
  });

  test('the process is unregistered', () => {
    dereg('procedure');
    return HP
      .call('procedure')
      .catch(error => error.message.should.equal('The procedure "procedure" doesn\'t exist'));
  });

  test('the return value represents the amount of processes removed', () => {
    dereg('procedure').should.equal(1);
    dereg('foo').should.equal(0);
  });
});

suite('deregAll()', () => {
  let spy;

  setup(() => {
    spy = sinon.spy();
    reg('procedure1', spy);
    reg('procedure2', spy);
  });

  test('it will remove all registered procedures', () => {
    deregAll();
    return HP
      .call('procedure1')
      .catch(() => {})
      .then(() => call('procedure2'))
      .catch(() => {})
      .then(() => spy.should.not.have.been.called);
  });
});

suite('call()', () => {
  let spy;

  setup(() => {
    spy = sinon.stub().returns('YAY');
    reg('proc', spy);
  });

  teardown(() => {
    dereg('proc');
  });

  test('returns a Promise', () => {
    call('proc').should.be.instanceOf(Promise);
  });

  test('the process is called', () => {
    let data = ['i', 'am', 'data'];
    return call('proc', data).then(() => {
      spy.should.have.been.calledOnce;
      spy.should.have.been.calledWithExactly(data);
    });
  });

  test('the result is given back', () => {
    return call('proc').then(data => data.should.equal('YAY'));
  });

  test('an event lifecycle is triggered', done => {
    before('proc', spy);
    on('proc', spy);
    after('proc', () => done());
    HP
      .call('proc')
      .then(() => spy.callCount.should.equal(3));
  });
});

suite('custom lifecycles', () => {
  let prevLifecycle;

  setup(() => {
    prevLifecycle = HP.lifecycle;
  });

  teardown(() => {
    HP.lifecycle = prevLifecycle;
  });

  test('methods are added', () => {
    HP.lifecycle = ['foo', 'bar', 'on', 'zob'];
    HP.should.not.respondTo('before');
    HP.should.not.respondTo('after');
    HP.should.respondTo('foo');
    HP.should.respondTo('bar');
    HP.should.respondTo('zob');
  });

  test('lifecycles can\'t contain duplicates', () => {
    (() => {
      HP.lifecycle = ['foo', 'foo', 'on'];
    })
    .should.throw('Lifecycle contains duplicates (foo)');
  });

  test('lifecycles must contain an "on" keywords', () => {
    (() => {
      HP.lifecycle = ['foo', 'bar', 'zob'];
    })
    .should.throw('Lifecycle (foo,bar,zob) must contain an "on" method');
  });
});

function testBeforePause(method) {
  return done => {
    let spy = sinon.spy();
    on('e', spy);
    method('e', () => new Promise(resolve => setTimeout(resolve, 100)));
    emit('e');
    setTimeout(() => spy.should.not.have.been.called, 90);
    setTimeout(() => {
      spy.should.have.been.calledOnce;
      done();
    }, 110);
  };
}

function testBeforeTimeout(method) {
  return () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    after('e', spyA);
    on('error.e', spyB);
    method('e', () => new Promise(resolve => setTimeout(resolve, HP.timeout + 5)));
    return emit('e').then(() => {
      spyA.should.have.been.calledOnce;
      spyB.should.have.been.calledOnce;
      let error = spyB.firstCall.args[1];
      error.should.be.instanceOf(Error);
      error.should.have.property('message', `Exceeded ${HP.timeout}ms`);
    });
  };
}

function testBeforeSubscriptions(method) {
  return () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    on('e', spyA);
    method('e', spyB);
    return emit('e').then(() => spyB.should.have.been.calledBefore(spyA));
  };
}

function testAfterSubscriptions(method) {
  return () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    method('e', spyA);
    on('e', spyB);
    return emit('e').then(() => {
      spyA.should.have.been.calledOnce;
      spyB.should.have.been.calledOnce;
      spyA.should.have.been.calledAfter(spyB);
    });
  };
}
