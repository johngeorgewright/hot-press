'use strict';

const flatten = require('lodash.flatten');
const ON = 'on';
const BEFORE = 'before';
const AFTER = 'after';
const HIERARCHY_SEPARATOR = '.';

/**
 * Listeners by event.
 *
 * [message]: {
 *   before: ...Function,
 *   on: ...Function,
 *   after: ...Function,
 * }
 *
 * @var Object
 */
let listeners = {};

/**
 * Returns all the listeners for a given message. The returned value will be an
 * object whose keys are 'before', 'on' and 'after' of which each will contain
 * an array of functions/listeners.
 *
 * @param String message
 * @return Object
 */
function getListenersFor(message) {
  if (!listeners[message]) listeners[message] = {
    [BEFORE]: [],
    [ON]: [],
    [AFTER]: []
  };
  return listeners[message];
}

/**
 * Returns a list of messages that should be called in order for a specific
 * message
 *
 * @param String message
 * @return String[]
 */
function getHierarchy(message) {
  let parts = message.split(HIERARCHY_SEPARATOR);
  let hierarchy = [parts[0], '*'];
  parts.reduce((message, part) => {
    let prefix = message + HIERARCHY_SEPARATOR;
    let newMessage = prefix + part;
    let wildcard = prefix + '*';
    hierarchy.unshift(newMessage, wildcard);
    return newMessage;
  });
  return hierarchy;
}

/**
 * Adds a listener to a specific part of an event's lifecycle.
 *
 * @param String part
 * @param String message
 * @param Function fn
 */
function onPart(part, message, fn) {
  getListenersFor(message)[part].push(fn);
}

/**
 * Adds a listener to the event.
 *
 * @param String message
 * @param Function fn
 */
function on(message, fn) {
  onPart(ON, message, fn);
}

/**
 * Adds a listener to the beginning of the event lifecycle.
 *
 * @param String message
 * @param Function fn
 */
function before(message, fn) {
  onPart(BEFORE, message, fn);
}

/**
 * Adds a listener to the end of the event lifecycle.
 *
 * @param String message
 * @param Function fn
 */
function after(message, fn) {
  onPart(AFTER, message, fn);
}

/**
 * Will call the listener once each of the specified events have been emitted.
 * The events are given as an object, where each key will specify the part of
 * the event lifecycle and the value is an array of event names/messages.
 *
 * ```
 * all({
 *   before: ['foo', 'bar'],
 *   on: ['another'],
 *   after: ['event']
 * }, ({foo, bar, another, event}) => {
 *   // You'll receive data for each event that fired
 * });
 * ```
 *
 * @param Object<before: String[], on: String[], after: String[]> messages
 * @param Function fn
 */
function all(messages, fn) {
  let toDo;
  let dataCollection;
  let size = Object
    .keys(messages)
    .reduce((size, part) => size + messages[part].length, 0);

  init();

  function subscriber(message, ...data) {
    dataCollection[message] = data;
    toDo--;
    if (!toDo) {
      fn(dataCollection);
      init();
    }
  }

  function registerSubscribers(prop, method) {
    if (messages[prop]) messages[prop].forEach(message => {
      method(message, subscriber);
    });
  }

  function init() {
    toDo = size;
    dataCollection = {};
    registerSubscribers('before', onceBefore);
    registerSubscribers('on', once);
    registerSubscribers('after', onceAfter);
  }
}

/**
 * Removes a listener from a given event.
 *
 * @param String message
 * @param Function fn
 * @return Number
 */
function removeListener(message, fn) {
  let listeners = getListenersFor(message);
  let removed = 0;
  for (let key in listeners) {
    let set = listeners[key];
    let index = set.indexOf(fn);
    if (index !== -1) {
      set.splice(index, 1);
      removed++;
      break;
    }
  }
  return removed;
}

/**
 * Removes all listeners from a given event.
 *
 * @param String message
 * @return Number
 */
function removeAllListeners(message) {
  let all = listeners[message];
  let amount = all ? all.length : 0;
  delete listeners[message];
  return amount;
}

/**
 * Removes the specified listener from a given event. If no listener is
 * specified, all will be removed.
 *
 * @param String message
 * @param Function fn
 * @return Number
 */
function off(message, fn) {
  return fn ? removeListener(message, fn) : removeAllListeners(message);
}

/**
 * Adds a listener to a specific part of the event lifecycle and removes it
 * as soon as it's been called.
 *
 * @param Function subscribe
 * @param String message
 * @param Function fn
 */
function oncePart(subscribe, message, fn) {
  let subscriber = (...args) => {
    off(message, subscriber);
    return fn(...args);
  };
  subscribe(message, subscriber);
}

/**
 * Adds the listener to the event for just one emittion.
 *
 * @param String message
 * @param Function fn
 */
function once(message, fn) {
  oncePart(on, message, fn);
}

/**
 * Adds a listener to the beginning of the event lifecycle for just one emittion.
 *
 * @param String message
 * @param Function fn
 */
function onceBefore(message, fn) {
  oncePart(before, message, fn);
}

/**
 * Adds a listener to the end of the event lifecycle for just one emittion.
 *
 * @param String message
 * @param Function fn
 */
function onceAfter(message, fn) {
  oncePart(after, message, fn);
}

/**
 * Creates an emitter based on the event name/message and data. The emitter
 * can then be used to emit each part of the lifecycle.
 *
 * @param String message
 * @param Any[] data
 * @return Function
 */
function createEmitter(message, data) {
  let call = fn => fn(message, ...data);
  let hierarchy = getHierarchy(message);
  return part => Promise.all(flatten(
    hierarchy.map(message => getListenersFor(message)[part].map(call))
  ));
}

/**
 * Fires off the lifecycle of an event.
 *
 * @param String message
 * @param Any ...data
 * @return Promise
 */
function emit(message, ...data) {
  let emit = createEmitter(message, data);
  return emit(BEFORE)
    .then(() => emit(ON))
    .then(() => emit(AFTER));
}

/**
 * Subscribes emittion of an array of events to another event. All data will be
 * passed to the emittions.
 *
 * @param Function subscribe
 * @param String message
 * @param String[] triggers
 */
function triggersPart(subscribe, message, triggers) {
  subscribe(message, (_, ...data) => Promise.all(
    triggers.map(message => emit(message, ...data))
  ));
}

/**
 * Registering that one event will trigger another, passing all data.
 *
 * @param String trigger
 * @param String[] messages
 */
function triggers(trigger, messages) {
  triggersPart(on, trigger, messages);
}

function triggersAfter(trigger, messages) {
  triggersPart(after, trigger, messages);
}

function triggersBefore(trigger, messages) {
  triggersPart(before, trigger, messages);
}

function triggersOnce(trigger, messages) {
  triggersPart(once, trigger, messages);
}

function triggersOnceAfter(trigger, messages) {
  triggersPart(onceAfter, trigger, messages);
}

function triggersOnceBefore(trigger, messages) {
  triggersPart(onceBefore, trigger, messages);
}

Object.assign(exports, {
  after, all, before, emit, off, on, once, onceAfter, onceBefore, triggers,
  triggersAfter, triggersBefore, triggersOnce, triggersOnceAfter,
  triggersOnceBefore
});
