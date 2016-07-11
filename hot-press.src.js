'use strict';

const ERROR = 'error';
const ON = 'on';
const HIERARCHY_SEPARATOR = '.';
const DEFAULT_LIFECYCLE = ['before', ON, 'after'];
const DEFAULT_TIMEOUT = 300;

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
 * Procedures referenced by the name.
 *
 * [name]: Function
 *
 * @var Object
 */
let procedures = {};

/**
 * Namespaced HotPress instances.
 *
 * @var Object<String: HotPress>
 */
let namespaces = {};

/**
 * Flattens an 2 dimensional array.
 *
 * @param Any[] arr
 * @return Any[]
 */
function flatten(arr) {
  return arr.reduce((a, b) => a.concat(b), []);
}

/**
 * Transforms the 1st character of a string to uppercase.
 *
 * @param String str
 * @return String
 */
function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Returns all the listeners for a given message. The returned value will be an
 * object whose keys are 'before', 'on' and 'after' of which each will contain
 * an array of functions/listeners.
 *
 * @param String message
 * @return Object<before: [], on: [], after: []>
 */
function getListenersFor(message) {
  if (!listeners[message]) {
    listeners[message] = this.lifecycle.reduce((acc, method) => (
      Object.assign(acc, {[method]: []})
    ), {});
  }
  return listeners[message];
}

/**
 * Returns an immutable version of all listeners on a particular event
 * name/message.
 *
 * @param String message
 * @return []
 */
function getAllListenersFor(message) {
  return Object
    .keys(listeners[message] || {})
    .reduce((acc, part) => acc.concat(listeners[message][part]), []);
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
function prependHierarchy(name, prefix) {
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
  fn._hpRemoved = false;
  getListenersFor.call(this, prependHierarchy(message, this.prefix))[part].push(fn);
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
 * Create a promise and reject it in a given amount of milliseconds.
 *
 * @param Number timeout
 * @return Promise
 */
function errorAfterMS(timeout) {
  return new Promise((_, reject) => {
    if (typeof timeout === 'number') setTimeout(
      () => reject(new HotPressTimeoutError(timeout)),
      timeout
    );
  });
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

/**
 * Creates an emitter based on the event name/message and data. The emitter
 * can then be used to emit each part of the lifecycle.
 *
 * @param String message
 * @param Any[] data
 * @return Function
 */
function createEmitter(message, data) {
  const hierarchy = getHierarchy(message);

  const call = fn => Promise
    .resolve()
    .then(() => !fn._hpRemoved && fn(message, ...data));

  const promise = fn => Promise
    .race([errorAfterMS(this.timeout), call(fn)])
    .catch(error => emit.call(this, prependHierarchy(message, ERROR), [error]));

  return part => Promise.all(flatten(
    hierarchy.map(message => getListenersFor.call(this, message)[part].map(promise))
  ));
}

/**
 * Begin the event lifecycle for a given event and data.
 *
 * @param String message
 * @param Any[] data
 * @param Number timeout  Optional amount of milliseconds to try each listener
 * @return Promise
 */
function emit(message, data) {
  let emit = createEmitter.call(this, message, data);
  return this.lifecycle.reduce((promise, method) => (
    promise.then(() => emit(method))
  ), Promise.resolve());
}

/**
 * Finds and returns duplicates in an array.
 *
 * @param Any[]
 * @return Any[]
 */
function findDuplicates(arr) {
  let dupCounts = arr.reduce((dupCounts, item) => Object.assign(dupCounts, {
    [item]: (dupCounts[item] || 0) + 1
  }), {});
  return Object.keys(dupCounts).filter(it => dupCounts[it] > 1);
}

/**
 * Removes a listener from a given event.
 *
 * @param String message
 * @param Function fn
 * @return Number
 */
function removeListener(message, fn) {
  let listeners = getListenersFor.call(this, message);
  let removed = 0;
  for (let key in listeners) {
    let set = listeners[key];
    let index = set.indexOf(fn);
    if (index !== -1) {
      set[index]._hpRemoved = true;
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
  let all = getAllListenersFor(message);
  let amount = all ? all.length : 0;
  all.forEach(listener => listener._hpRemoved = true);
  delete listeners[message];
  return amount;
}

/**
 * Returns a method name we may use to attach a single listener.
 *
 * @param String method
 * @return String
 */
function singularMethodName(method) {
  return method === ON ? 'once' : `once${upperFirst(method)}`;
}

/**
 * Returns a method name we may use as the trigger listener.
 *
 * @param String method
 * @param String
 */
function triggerMethodName(method) {
  return method === ON ? 'triggers' : `triggers${upperFirst(method)}`;
}

function startOfLifecycle() {
  let start = [];
  let lifecycle = this.lifecycle.slice();
  for (let part = lifecycle.shift(); part !== ON; part = lifecycle.shift()) {
    start.push(part);
  }
  return start;
}

function endOfLifecycle() {
  let end = [];
  let lifecycle = this.lifecycle.slice();
  for (let part = lifecycle.pop(); part !== ON; part = lifecycle.pop()) {
    end.unshift(part);
  }
  return end;
}

/**
 * The exposable methods for each HotPress namespace.
 *
 * @class HotPress
 * @param String prefix
 * @param String[] lifecycle
 * @param Number timeout
 */
class HotPress {

  constructor(
    prefix = '',
    lifecycle = DEFAULT_LIFECYCLE,
    timeout = DEFAULT_TIMEOUT
  ) {
    /**
     * The prefix to add to all messages
     *
     * @prop String prefix
     */
    this.prefix = prefix;

    /**
     * The lifecycle list
     * @prop String[] lifecycle
     */
    this._lifecycle = [];
    this.lifecycle = lifecycle;

    /**
     * Timeout to stop long processes within the event lifecycle.
     *
     * @prop Number timeout
     */
    this.timeout = timeout;

    this.all = this.all.bind(this);
    this.call = this.call.bind(this);
    this.dereg = this.dereg.bind(this);
    this.emit = this.emit.bind(this);
    this.ns = this.ns.bind(this);
    this.off = this.off.bind(this);
    this.reg = this.reg.bind(this);
  }

  get lifecycle() {
    return this._lifecycle;
  }

  set lifecycle(lifecycle) {
    let {_lifecycle} = this;
    let duplicates = findDuplicates(lifecycle);
    this._lifecycle = lifecycle;

    if (duplicates.length) {
      throw new Error(`Lifecycle contains duplicates (${duplicates})`);
    }

    if (!~lifecycle.indexOf(ON)) {
      throw new Error(`Lifecycle (${lifecycle}) must contain an "on" method`);
    }

    _lifecycle.forEach(method => { delete this[method]; });

    lifecycle.forEach(method => {
      let singularName = singularMethodName(method);
      let triggersName = triggerMethodName(method);
      let singularTriggersName = triggerMethodName(singularName);

      this[method] = onPart.bind(this, method);
      this[singularName] = oncePart.bind(this, this[method]);
      this[triggersName] = triggersPart.bind(this, this[method]);
      this[singularTriggersName] = triggersPart.bind(this, this[singularName]);
    });
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
      this.lifecycle.forEach(method => {
        registerSubscribers(method, this[singularMethodName(method)]);
      });
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
    message = prependHierarchy(message, this.prefix);
    return fn
      ? removeListener.call(this, message, fn)
      : removeAllListeners.call(this, message);
  }

  /**
   * Adds a listener to the end of the event lifecycle for just one emittion.
   *
   * @param String message
   * @param ...Any data
   * @return Promise
   */
  emit(message, ...data) {
    message = prependHierarchy(message, this.prefix);
    return emit.call(this, message, data);
  }

  /**
   * Creates another version of hot press where all events are prefixed with
   * the given string.
   *
   * @param String namespace
   * @return HotPress
   */
  ns(name) {
    let fullName = prependHierarchy(name, this.prefix);
    if (namespaces[fullName]) return namespaces[fullName];
    return name.split(HIERARCHY_SEPARATOR).reduce((parent, name) => {
      name = prependHierarchy(name, parent.prefix);
      return namespaces[name] = namespaces[name] || new HotPress(
        name, parent.lifecycle, parent.timeout
      );
    }, this);
  }

  /**
   * Register a process to a name.
   *
   * @param String name
   * @param Function proc
   * @throws HotPressExistingProcedureError
   */
  reg(name, proc) {
    name = prependHierarchy(name, this.prefix);
    proc._hpRemove = false;
    if (procedures[name]) throw new HotPressExistingProcedureError(name);
    procedures[name] = proc;
  }

  /**
   * Deregisters a process.
   *
   * @param String name
   * @return Number
   */
  dereg(name) {
    name = prependHierarchy(name, this.prefix);
    if (procedures[name]) {
      procedures[name]._hpRemoved = true;
      delete procedures[name];
      return 1;
    }
    return 0;
  }

  /**
   * Calls a procedure and begins an event lifecycle too.
   *
   * @param String name
   * @param ...Any
   * @return Promise
   */
  call(name, ...data) {
    name = prependHierarchy(name, this.prefix);
    const emit = createEmitter.call(this, name, data);
    const lifecycleReducer = (promise, method) => (
      promise.then(() => emit(method))
    );
    const proc = procedures[name] || (() => {
      throw new HotPressNonExistingProcedureError(name);
    });
    let promise = startOfLifecycle.call(this).reduce(lifecycleReducer, Promise.resolve());
    promise = promise
      .then(() => Promise.all([
        !proc._hpRemoved && proc(...data),
        emit(ON)
      ]))
      .then(([result]) => result);
    endOfLifecycle.call(this).reduce(lifecycleReducer, promise);
    return promise;
  }

}

class HotPressTimeoutError extends Error {
  constructor(ms) {
    super(`Exceeded ${ms}ms`);
  }
}

class HotPressExistingProcedureError extends Error {
  constructor(name) {
    super(`The procedure "${name}" is already registered`);
  }
}

class HotPressNonExistingProcedureError extends Error {
  constructor(name) {
    super(`The procedure "${name}" doesn't exist`);
  }
}

module.exports = Object.assign(new HotPress(), {
  HotPressTimeoutError, HotPressExistingProcedureError,
  HotPressNonExistingProcedureError
});
