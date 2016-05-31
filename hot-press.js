'use strict';

const ON = 'on';
const BEFORE = 'before';
const AFTER = 'after';
const HIERACHY_SEPARATOR = '.';

let subscriptions = {};

function getSubscriptionsFor(message) {
  if (!subscriptions[message]) subscriptions[message] = {
    [BEFORE]: [],
    [ON]: [],
    [AFTER]: []
  };
  return subscriptions[message];
}

function getHierachy(message) {
  let parts = message.split(HIERACHY_SEPARATOR);
  let hierachy = [parts[0]];
  parts.reduce((message, part) => {
    message += HIERACHY_SEPARATOR + part;
    hierachy.push(message);
    return message;
  });
  return hierachy.reverse();
}

function onPart(part, message, fn) {
  getHierachy(message).forEach(message => {
    getSubscriptionsFor(message)[part].push(fn);
  });
}

function on(message, fn) {
  onPart(ON, message, fn);
}

function before(message, fn) {
  onPart(BEFORE, message, fn);
}

function after(message, fn) {
  onPart(AFTER, message, fn);
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

function oncePart(subscribe, message, fn) {
  let subscriber = (...args) => {
    off(message, subscriber);
    return fn(...args);
  };
  subscribe(message, subscriber);
}

function once(message, fn) {
  oncePart(on, message, fn);
}

function onceBefore(message, fn) {
  oncePart(before, message, fn);
}

function onceAfter(message, fn) {
  oncePart(after, message, fn);
}

function createEmitter(message, data) {
  let subscriptions = getSubscriptionsFor(message);
  return part => Promise.all(flatten(
    getHierachy(message).map(message => (
      subscriptions[part].map(fn => fn(message, ...data))
    )
  )));
}

function emit(message, ...data) {
  let emit = createEmitter(message, data);
  return emit(BEFORE)
    .then(() => emit(ON))
    .then(() => emit(AFTER));
}

function trigger(trigger, messages) {
  on(trigger, (_, ...data) => (
    messages.map(message => emit(message, ...data))
  ));
}

function flatten(arr) {
  return arr.reduce((a, b) => a.concat(b));
}

Object.assign(exports, {
  after, all, before, emit, off, on, once, onceAfter, onceBefore, trigger
});
