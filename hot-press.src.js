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
 * A objet containing all the methods that hot-press can possibly be namespaced.
 *
 * @var Object
 */
let HP = {};

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
HP.on = (message, fn) => onPart(ON, message, fn);

/**
 * Adds a listener to the beginning of the event lifecycle.
 *
 * @param String message
 * @param Function fn
 */
HP.before = (message, fn) => onPart(BEFORE, message, fn);

/**
 * Adds a listener to the end of the event lifecycle.
 *
 * @param String message
 * @param Function fn
 */
HP.after = (message, fn) => onPart(AFTER, message, fn);

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
HP.all = (messages, fn) => {
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
    registerSubscribers('before', HP.onceBefore);
    registerSubscribers('on', HP.once);
    registerSubscribers('after', HP.onceAfter);
  }
};

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
HP.off = (message, fn) => {
  return fn ? removeListener(message, fn) : removeAllListeners(message);
};

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
    HP.off(message, subscriber);
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
HP.once = (message, fn) => oncePart(HP.on, message, fn);

/**
 * Adds a listener to the beginning of the event lifecycle for just one emittion.
 *
 * @param String message
 * @param Function fn
 */
HP.onceBefore = (message, fn) => oncePart(HP.before, message, fn);

/**
 * Adds a listener to the end of the event lifecycle for just one emittion.
 *
 * @param String message
 * @param Function fn
 */
HP.onceAfter = (message, fn) => oncePart(HP.after, message, fn);

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
HP.emit = (message, ...data) => {
  let emit = createEmitter(message, data);
  return emit(BEFORE)
    .then(() => emit(ON))
    .then(() => emit(AFTER));
};

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
    triggers.map(message => HP.emit(message, ...data))
  ));
}

/**
 * Registering that one event will trigger another, passing all data.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggers = (trigger, messages) => triggersPart(HP.on, trigger, messages);

/**
 * Registering that one event will trigger another, after the lifecycle.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggersAfter = (trigger, messages) => triggersPart(HP.after, trigger, messages);

/**
 * Registering that one event will trigger another, before the lifecycle.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggersBefore = (trigger, messages) => triggersPart(HP.before, trigger, messages);

/**
 * Registering that one event will trigger another, just once.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggersOnce = (trigger, messages) => triggersPart(HP.once, trigger, messages);

/**
 * Registering that one event will trigger another, just once, after the
 * lifecycle.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggersOnceAfter = (trigger, messages) => triggersPart(HP.onceAfter, trigger, messages);

/**
 * Registering that one event will trigger another, just once, before the
 * lifecycle.
 *
 * @param String trigger
 * @param String[] messages
 */
HP.triggersOnceBefore = (trigger, messages) => triggersPart(HP.onceBefore, trigger, messages);

/**
 * Decorates an argument of a function call.
 *
 * @param Function method
 * @param Number nthArg
 * @param Function decorate
 * @return Function
 */
function decorateArg(method, nthArg, decorate) {
  return (...args) => {
    args.splice(nthArg, 1, decorate(args[nthArg]));
    return method(...args);
  };
}

/**
 * Returns a version of hot-press of which all event names are prefixed with a
 * namespace.
 *
 * @param String ns
 * @return Object
 */
function ns(ns) {
  let decorateMessage = message => `${ns}.${message}`;
  let decorateMessages = ms => ms.map(decorateMessage);
  let methods = Object.keys(HP);

  let object = methods.reduce((object, method) => Object.assign(object, {
    [method]: decorateArg(HP[method], 0, decorateMessage)
  }), {});

  return methods
    .filter(method => method.startsWith('triggers'))
    .reduce((object, method) => Object.assign(object, {
      [method]: decorateArg(object[method], 1, decorateMessages)
    }), object);
}

Object.assign(exports, HP, {ns});
