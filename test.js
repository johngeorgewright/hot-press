'use strict';
/*eslint-env mocha*/

const chai = require('chai');
const HP = require('./hot-press');
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
});

suite('on()', () => {
  test('subscribes to events', () => {
    let spy  = sinon.spy();
    HP.on('e', spy);
    return HP.emit('e').then(() => spy.should.have.been.calledOnce);
  });

  test('gives the message name and any data', () => {
    HP.on('e', (message, data) => {
      message.should.equal('e');
      data.should.eql({mung: 'face'});
    });
    return HP.emit('e', {mung: 'face'});
  });
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
    return HP.emit('e')
      .then(HP.emit('e'))
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
    return HP.emit('e')
      .then(HP.emit('e'))
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
    return HP.emit('e')
      .then(HP.emit('e'))
      .then(() => spy.should.have.been.calledOnce);
  });
});

function testBeforePause(method) {
  return done => {
    let spy = sinon.spy();
    HP.on('e', spy);
    method('e', () => new Promise(resolve => setTimeout(resolve, 100)));
    HP.emit('e');
    setTimeout(() => {
      spy.should.not.have.been.called;
    }, 90);
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
