'use strict';

let subscriptions = {};

function getSubscriptionsFor(message) {
  if (!subscriptions[message]) subscriptions[message] = {
    before: [],
    on: [],
    after: []
  };
  return subscriptions[message];
}

function onPart(message, part, fn) {
  getSubscriptionsFor(message)[part].push(fn);
}

function on(message, fn) {
  onPart(message, 'on', fn);
}

function all(messages, fn) {
  let toDo = messages.length;
  let dataCollection = {};
  let subscriber = (message, ...data) => {
    dataCollection[message] = data;
    toDo--;
    if (!toDo) {
      fn(dataCollection);
      toDo = messages.length;
    }
  };
  messages.forEach(message => on(message, subscriber));
}

function before(message, fn) {
  onPart(message, 'before', fn);
}

function after(message, fn) {
  onPart(message, 'after', fn);
}

function off(message, fn) {
  if (fn) {
    let subscriptions = getSubscriptionsFor(message);
    for (let key in subscriptions) {
      let set = subscriptions[key];
      let index = set.indexOf(fn);
      if (index !== -1) {
        set.splice(index, 1);
        break;
      }
    }
  } else {
    delete subscriptions[message];
  }
}

function oncePart(message, subscribe, fn) {
  let subscription = (...args) => {
    off(message, subscription);
    return fn(...args);
  };
  subscribe(message, subscription);
}

function once(message, fn) {
  oncePart(message, on, fn);
}

function onceBefore(message, fn) {
  oncePart(message, before, fn);
}

function onceAfter(message, fn) {
  oncePart(message, after, fn);
}

function emit(message, ...data) {
  let subscriptions = getSubscriptionsFor(message);
  let emit = part => Promise.all(
    subscriptions[part].map(fn => fn(message, ...data))
  );
  return emit('before')
    .then(() => emit('on'))
    .then(() => emit('after'));
}

function trigger(trigger, messages) {
  on(trigger, (_, ...data) => (
    messages.map(message => emit(message, ...data))
  ));
}

Object.assign(exports, {
  after, all, before, emit, off, on, once, onceAfter, onceBefore, trigger
});
