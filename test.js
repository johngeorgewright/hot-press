'use strict';
/*eslint-env mocha*/

const chai = require('chai');
const HP = require('./hot-press.src');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const functions = require('lodash.functions');

chai.use(sinonChai);
chai.should();

teardown(() => {
  HP.off('e');
  HP.off('e1');
  HP.off('e2');
});

suite('emit()', () => {
  test('it returns a promise', () => {
    HP.emit('e').should.be.instanceof(Promise);
  });

  test('it resolves once all subscribers have resolved', () => {
    let spy = sinon.spy();
    let resolve = () => new Promise(resolve => {
      spy();
      resolve();
    });
    HP.on('e', resolve);
    HP.before('e', resolve);
    HP.after('e', resolve);
    return HP.emit('e').then(() => spy.should.have.been.calledThrice);
  });
});

suite('on()', () => {
  test('subscribes to events', () => {
    let spy = sinon.spy();
    HP.on('e', spy);
    return HP.emit('e').then(() => spy.should.have.been.calledOnce);
  });

  test('gives the message name and any data', () => {
    HP.on('e', (message, ...data) => {
      message.should.equal('e');
      data.should.eql([{mung: 'face'}, {some: 'thing'}]);
    });
    return HP.emit('e', {mung: 'face'}, {some: 'thing'});
  });

  test('wildcards', () => {
    let spy = sinon.spy();
    HP.on('*', spy);
    return HP.emit('e')
      .then(() => spy.should.have.been.calledWith('e'))
      .then(() => HP.emit('f'))
      .then(() => spy.should.have.been.calledWith('f'))
      .then(() => HP.off('*'));
  });

  test('wildcards in hierarchy', () => {
    let spy = sinon.spy();
    HP.on('e.*', spy);
    return HP.emit('e.f')
      .then(() => spy.should.have.been.calledWith('e.f'))
      .then(() => HP.emit('e.f.g'))
      .then(() => spy.should.have.been.calledWith('e.f.g'))
      .then(() => HP.off('e.*'));
  });

  test('error handling', () => {
    let spy = sinon.spy();
    let error = new Error('should be swallowed');
    HP.on('e', () => { throw error; });
    HP.on('error.e', spy);
    return HP
      .emit('e')
      .then(() => spy.should.have.been.calledOnce)
      .then(() => spy.should.have.been.calledWithExactly('error.e', error))
      .then(() => HP.off('error.e'));
  });
});

suite('all()', () => {
  let spy;

  setup(() => {
    spy = sinon.spy();
    HP.all({before: ['e4'], on: ['e', 'e1', 'e2'], after: ['e3']}, spy);
  });

  teardown(() => Promise.all([
    HP.off('e1'),
    HP.off('e2'),
    HP.off('e3'),
    HP.off('e4')
  ]));

  test('is called once all events have been published', () => (
    HP.emit('e')
      .then(() => HP.emit('e1'))
      .then(() => HP.emit('e1'))
      .then(() => HP.emit('e2'))
      .then(() => HP.emit('e3'))
      .then(() => HP.emit('e4'))
      .then(() => spy.should.have.been.calledOnce)
  ));

  test('that the data and event names have been passed to the subscriber', () => (
    Promise.all([
      HP.emit('e', 1, 2),
      HP.emit('e1', 3, 4),
      HP.emit('e2', 5, 6, 7),
      HP.emit('e3', 8),
      HP.emit('e4', 9, 10)
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
    HP.on('e', spyA);
    HP.on('e', spyB);
  });

  test('unsubscribes a specific listener', () => {
    HP.off('e', spyA);
    return HP.emit('e').then(() => {
      spyA.should.not.have.been.called;
      spyB.should.have.been.calledOnce;
    });
  });

  test('unsubscribes all listeners', () => {
    HP.off('e');
    return HP.emit('e').then(() => {
      spyA.should.not.have.been.called;
      spyB.should.not.have.been.called;
    });
  });

  test('returns the amount listeners removed', () => {
    HP.off('e').should.equal(2);
    HP.off('e').should.equal(0);
  });

  test('we can add the same listener back again', () => {
    HP.off('e');
    HP.on('e', spyA);
    return HP.emit('e').then(() => {
      spyA.should.have.been.calledOnce;
    });
  });
});

suite('once()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    HP.once('e', spy);
    return Promise.all([HP.emit('e'), HP.emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('before()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions(HP.before));

  test('pauses other events', testBeforePause(HP.before));

  test('timeouts for long processes', testBeforeTimeout(HP.before));

  test('many subscribers', () => {
    let spy = sinon.spy();
    HP.before('e', spy);
    HP.before('e', spy);
    return HP.emit('e').then(() => spy.should.have.been.calledTwice);
  });
});

suite('onceBefore()', () => {
  test('subscribes to events before they\'re properly published', testBeforeSubscriptions(HP.onceBefore));

  test('pauses other events', testBeforePause(HP.onceBefore));

  test('it will only subscribe to the first event', () => {
    let spy = sinon.spy();
    HP.onceBefore('e', spy);
    return Promise
      .all([HP.emit('e'), HP.emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('after()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions(HP.after));
});

suite('onceAfter()', () => {
  test('subscribes to events after they\'re published', testAfterSubscriptions(HP.onceAfter));

  test('subscribes only to the first event', () => {
    let spy = sinon.spy();
    HP.onceAfter('e', spy);
    return Promise
      .all([HP.emit('e'), HP.emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggers()', () => {
  teardown(() => {
    HP.off('e1');
    HP.off('e2');
  });

  test('the array of events are triggered by another event', () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    HP.on('e1', spyA);
    HP.on('e1', spyB);
    HP.on('e2', spyA);
    HP.on('e2', spyB);
    HP.triggers('e', ['e1', 'e2']);
    return HP.emit('e').then(() => {
      spyA.should.have.been.calledTwice;
      spyB.should.have.been.calledTwice;
    });
  });

  test('the data is passed from the trigger to the tiggered', () => {
    let spy = sinon.spy();
    HP.on('e1', spy);
    HP.triggers('e', ['e1']);
    return HP.emit('e', 'foo', 'bar').then(() => {
      spy.should.have.been.calledWith('e1', 'foo', 'bar');
    });
  });
});

suite('triggersAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    HP.on('e1', spy);
    HP.triggersAfter(message, ['e1']);
  }));
});

suite('triggersBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    HP.on('e1', spy);
    HP.triggersBefore(message, ['e1']);
  }));

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    HP.on('e1', wait);
    HP.triggersBefore(message, ['e1']);
  }));
});

suite('triggersOnce()', () => {
  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    HP.on('e1', spy);
    HP.triggersOnce('e', ['e1']);
    return Promise.all([HP.emit('e'), HP.emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggersOnceBefore()', () => {
  test('it subscribes to the beginning of the event life cycle', testBeforeSubscriptions((message, spy) => {
    HP.on('e1', spy);
    HP.triggersOnceBefore(message, ['e1']);
  }));

  test('it can pause the next part of the event life cycle', testBeforePause((message, wait) => {
    HP.on('e1', wait);
    HP.triggersOnceBefore(message, ['e1']);
  }));

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    HP.on('e1', spy);
    HP.triggersOnceBefore('e', ['e1']);
    return Promise.all([HP.emit('e'), HP.emit('e')])
      .then(() => spy.should.have.been.calledOnce);
  });
});

suite('triggersOnceAfter()', () => {
  test('it subscribes to after the event life cycle', testAfterSubscriptions((message, spy) => {
    HP.on('e1', spy);
    HP.triggersOnceAfter(message, ['e1']);
  }));

  test('it subscribes only to the first event', () => {
    let spy = sinon.spy();
    HP.on('e1', spy);
    HP.triggersOnceAfter('e', ['e1']);
    return Promise.all([HP.emit('e'), HP.emit('e')])
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
    HP.reg('proc', () => {});
  });

  teardown(() => {
    HP.dereg('proc');
  });

  test('it will only allow one procedure per name', () => {
    let incorrect = () => HP.reg('proc', () => {});
    incorrect.should.throw('The procedure "proc" is already registered');
  });
});

suite('dereg()', () => {
  let spy;

  setup(() => {
    spy = sinon.spy();
    HP.reg('procedure', spy);
  });

  test('the process is unregistered', () => {
    HP.dereg('procedure');
    return HP
      .call('procedure')
      .catch(error => error.message.should.equal('The procedure "procedure" doesn\'t exist'));
  });

  test('the return value represents the amount of processes removed', () => {
    HP.dereg('procedure').should.equal(1);
    HP.dereg('foo').should.equal(0);
  });
});

suite('call()', () => {
  let spy;

  setup(() => {
    spy = sinon.stub().returns('YAY');
    HP.reg('proc', spy);
  });

  teardown(() => {
    HP.dereg('proc');
  });

  test('returns a Promise', () => {
    HP.call('proc').should.be.instanceOf(Promise);
  });

  test('the process is called', () => {
    let data = ['i', 'am', 'data'];
    return HP.call('proc', data).then(() => {
      spy.should.have.been.calledOnce;
      spy.should.have.been.calledWithExactly(data);
    });
  });

  test('the result is given back', () => {
    return HP.call('proc').then(data => data.should.equal('YAY'));
  });

  test('an event lifecycle is triggered', done => {
    HP.before('proc', spy);
    HP.on('proc', spy);
    HP.after('proc', () => done());
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
    (() => HP.lifecycle = ['foo', 'foo', 'on'])
    .should.throw('Lifecycle contains duplicates (foo)');
  });

  test('lifecycles must contain an "on" keywords', () => {
    (() => HP.lifecycle = ['foo', 'bar', 'zob'])
    .should.throw('Lifecycle (foo,bar,zob) must contain an "on" method');
  });
});

function testBeforePause(method) {
  return done => {
    let spy = sinon.spy();
    HP.on('e', spy);
    method('e', () => new Promise(resolve => setTimeout(resolve, 100)));
    HP.emit('e');
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
    HP.after('e', spyA);
    HP.on('error.e', spyB);
    method('e', () => new Promise(resolve => setTimeout(resolve, HP.timeout + 5)));
    return HP.emit('e').then(() => {
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
    HP.on('e', spyA);
    method('e', spyB);
    return HP.emit('e').then(() => spyB.should.have.been.calledBefore(spyA));
  };
}

function testAfterSubscriptions(method) {
  return () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    method('e', spyA);
    HP.on('e', spyB);
    return HP.emit('e').then(() => {
      spyA.should.have.been.calledOnce;
      spyB.should.have.been.calledOnce;
      spyA.should.have.been.calledAfter(spyB);
    });
  };
}
