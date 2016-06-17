'use strict';
/*eslint-env mocha*/

const chai = require('chai');
const HP = require('./hot-press.src');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);
chai.should();

teardown(() => HP.off('e'));

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

  test('subscription hierarchy', () => {
    let spyA = sinon.spy();
    let spyB = sinon.spy();
    HP.on('e.f', spyA);
    HP.on('e', spyB);
    return HP.emit('e.f')
      .then(() => spyA.should.have.been.calledOnce)
      .then(() => spyB.should.have.been.calledOnce)
      .then(() => spyA.should.have.been.calledWithExactly('e.f'))
      .then(() => spyB.should.have.been.calledWithExactly('e.f'))
      .then(() => HP.off('e.f'));
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
      .then(() => HP.off('e.*'));
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
      .then(() => spy.should.not.have.been.called)
      .then(() => HP.emit('e1'))
      .then(() => HP.emit('e1'))
      .then(() => spy.should.not.have.been.called)
      .then(() => HP.emit('e2'))
      .then(() => HP.emit('e3'))
      .then(() => spy.should.not.have.been.called)
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
