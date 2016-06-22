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
 * Prepends an event name, if the string exists.
 *
 * @param String name
 * @param String prefix
 * @return String
 */
function prependEventName(name, prefix) {
  return prefix ? `${prefix}.${name}` : name;
}

/**
 * Adds a listener to a specific part of an event's lifecycle.
 *
 * @param String part
 * @param String message
 * @param Function fn
 */
function onPart(part, message, fn) {
  getListenersFor(prependEventName(message, this.prefix))[part].push(fn);
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
 * Adds a listener to a specific part of the event lifecycle and removes it
 * as soon as it's been called.
 *
 * @param Function subscribe
 * @param String message
 * @param Function fn
 */
function oncePart(subscribe, message, fn) {
  let subscriber = (...args) => {
    this.off(message, subscriber);
    return fn(...args);
  };
  subscribe(message, subscriber);
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
 * Subscribes emittion of an array of events to another event. All data will be
 * passed to the emittions.
 *
 * @param Function subscribe
 * @param String message
 * @param String[] triggers
 */
function triggersPart(subscribe, message, triggers) {
  subscribe(message, (_, ...data) => Promise.all(
    triggers.map(message => this.emit(message, ...data))
  ));
}

class HotPress {

  constructor(prefix='') {
    /**
     * The prefix to add to all messages
     *
     * @var String
     */
    this.prefix = prefix;

    this.emit = this.emit.bind(this);
    this.all = this.all.bind(this);
    this.off = this.off.bind(this);
    this.ns = this.ns.bind(this);

    /**
     * Adds a listener to the beginning of the event lifecycle.
     *
     * @param String message
     * @param Function fn
     */
    this.before = onPart.bind(this, BEFORE);

    /**
     * Adds a listener to the event.
     *
     * @param String message
     * @param Function fn
     */
    this.on = onPart.bind(this, ON);

    /**
     * Adds a listener to the end of the event lifecycle.
     *
     * @param String message
     * @param Function fn
     */
    this.after = onPart.bind(this, AFTER);

    /**
     * Adds a listener to the beginning of the event lifecycle for just one
     * emittion.
     *
     * @param String message
     * @param Function fn
     */
    this.onceBefore = oncePart.bind(this, this.before);

    /**
     * Adds the listener to the event for just one emittion.
     *
     * @param String message
     * @param Function fn
     */
    this.once = oncePart.bind(this, this.on);

    /**
     * Adds a listener to the end of the event lifecycle for just one emittion.
     *
     * @param String message
     * @param Function fn
     */
    this.onceAfter = oncePart.bind(this, this.after);

    /**
     * Registering that one event will trigger another, passing all data.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggers = triggersPart.bind(this, this.on);

    /**
     * Registering that one event will trigger another, after the lifecycle.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggersAfter = triggersPart.bind(this, this.after);

    /**
     * Registering that one event will trigger another, before the lifecycle.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggersBefore = triggersPart.bind(this, this.before);

    /**
     * Registering that one event will trigger another, just once.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggersOnce = triggersPart.bind(this, this.once);

    /**
     * Registering that one event will trigger another, just once, after the
     * lifecycle.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggersOnceAfter = triggersPart.bind(this, this.onceAfter);

    /**
     * Registering that one event will trigger another, just once, before the
     * lifecycle.
     *
     * @param String trigger
     * @param String[] messages
     */
    this.triggersOnceBefore = triggersPart.bind(this, this.onceBefore);
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
  all(messages, fn) {
    let toDo;
    let dataCollection;
    let size = Object
      .keys(messages)
      .reduce((size, part) => size + messages[part].length, 0);

    const subscriber = (message, ...data) => {
      dataCollection[message] = data;
      toDo--;
      if (!toDo) {
        fn(dataCollection);
        init();
      }
    };

    const registerSubscribers = (prop, method) => {
      if (messages[prop]) messages[prop].forEach(message => {
        method(message, subscriber);
      });
    };

    const init = () => {
      toDo = size;
      dataCollection = {};
      registerSubscribers(BEFORE, this.onceBefore);
      registerSubscribers(ON, this.once);
      registerSubscribers(AFTER, this.onceAfter);
    };

    init();
  }

  /**
   * Removes the specified listener from a given event. If no listener is
   * specified, all will be removed.
   *
   * @param String message
   * @param Function fn
   * @return Number
   */
  off(message, fn) {
    message = prependEventName(message, this.prefix);
    return fn ? removeListener(message, fn) : removeAllListeners(message);
  }

  /**
   * Adds a listener to the end of the event lifecycle for just one emittion.
   *
   * @param String message
   * @param Function fn
   */
  emit(message, ...data) {
    let emit = createEmitter(prependEventName(message, this.prefix), data);
    return emit(BEFORE)
      .then(() => emit(ON))
      .then(() => emit(AFTER));
  }

  ns(namespace) {
    return new HotPress(prependEventName(namespace, this.prefix));
  }

}

module.exports = new HotPress();
