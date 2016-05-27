let subscriptions = {};

function getSubscriptionsFor(message) {
  if (!subscriptions[message]) subscriptions[message] = [];
  return subscriptions[message];
}

function beforeMessage(message) {
  return `before ${message}`;
}

function afterMessage(message) {
  return `after ${message}`;
}

function on(message, fn) {
  getSubscriptionsFor(message).push(fn);
}

function before(message, fn) {
  on(beforeMessage(message), fn);
}

function after(message, fn) {
  on(afterMessage(message), fn);
}

function off(message, fn) {
  let messages = [beforeMessage(message), message, afterMessage(message)];
  if (fn) {
    for (let i = 0; i < messages.length; i++) {
      let set = getSubscriptionsFor(messages[i]);
      let index = set.indexOf(fn);
      if (index !== -1) {
        set.splice(index, 1);
        break;
      }
    }
  } else {
    messages.forEach(message => getSubscriptionsFor(message).length = 0);
  }
}

function once(message, fn) {
  let subscription = (...args) => {
    off(message, subscription);
    return fn(...args);
  };
  on(message, subscription);
}

function onceBefore(message, fn) {
  return once(beforeMessage(message), fn);
}

function onceAfter(message, fn) {
  return once(afterMessage(message), fn);
}

function createEmitter(data) {
  return message => Promise.all(
    getSubscriptionsFor(message).map(fn => fn(message, data))
  );
}

function emit(message, data) {
  let emit = createEmitter(data);
  return emit(beforeMessage(message))
    .then(() => emit(message))
    .then(() => emit(afterMessage(message)));
}

Object.assign(exports, {
  after, before, emit, off, on, once, onceAfter, onceBefore
});
