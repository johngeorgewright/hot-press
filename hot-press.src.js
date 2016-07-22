/**
 * @module hot-press
 */

'use strict';

/**
 * String representing wildcards
 * @private
 * @type {String}
 */
const WILDCARD = '*';

/**
 * The error namespace
 * @private
 * @type {String}
 */
const ERROR = 'error';

/**
 * The "on" lifecycle part
 * @private
 * @type {String}
 */
const ON = 'on';

/**
 * What separates namespace hierarchy
 * @private
 * @type {String}
 */
const HIERARCHY_SEPARATOR = '.';

/**
 * The default lifecycle.
 * @private
 * @type {String[]}
 */
const DEFAULT_LIFECYCLE = ['before', ON, 'after'];

/**
 * The default timeout
 * @private
 * @type {Number}
 */
const DEFAULT_TIMEOUT = 300;

/**
 * Listeners by event.
 *
 * [message]: {
 *   before: ...Function,
 *   on: ...Function,
 *   after: ...Function,
 * }
 * @type {Object}
 * @private
 */
let listeners = {};

/**
 * Procedures referenced by the name.
 * [name]: Function
 * @type {Object}
 * @private
 */
let procedures = {};

/**
 * Namespaced HotPress instances.
 * @type {Object.<string, Function>}
 * @private
 */
let namespaces = {};

/**
 * Flattens an 2 dimensional array.
 * @private
 * @param {Any[]} arr - The array to flatten
 * @return {Any[]} The flattened array
 */
function flatten(arr) {
  return arr.reduce((a, b) => a.concat(b), []);
}

/**
 * Transforms the 1st character of a string to uppercase.
 * @private
 * @param {String} str - The string to manipulate.
 * @return {String} The transformed string.
 */
function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Returns all the listeners for a given message. The returned value will be an
 * object whose keys are 'before', 'on' and 'after' of which each will contain
 * an array of functions/listeners.
 * @private
 * @param {String} message - The event name/message
 * @return {Object} The event listeners grouped by lifecycle parts
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
 * Returns version of all listeners on a particular event name/message.
 * @private
 * @param {String} message - The event name/message
 * @return {Function[]} An ordered array of listeners
 */
function getAllListenersFor(message) {
  return Object
    .keys(listeners[message] || {})
    .reduce((acc, part) => acc.concat(listeners[message][part]), []);
}

/**
 * Returns a list of messages that should be called in order for a specific
 * message.
 * @private
 * @example
 * getHierarchy('a.b.c.d');
 * // ==> ['a.b.c.d', 'a.b.c.*', 'a.b.*', 'a.*', '*']
 * @param {String} message - The event name/message
 * @return {String[]} The ordered list of messages that should be called
 */
function getHierarchy(message) {
  let parts = message.split(HIERARCHY_SEPARATOR);
  let hierarchy = [WILDCARD];
  parts.reduce((message, part) => {
    let prefix = message + HIERARCHY_SEPARATOR;
    hierarchy.unshift(prefix + WILDCARD);
    return prefix + part;
  });
  hierarchy.unshift(message);
  return hierarchy;
}

/**
 * Prepends an event name, if the string exists.
 * @private
 * @param {String} name - The event name/message
 * @param {String} prefix - The prefix to prepend
 * @return {String} The transformed string
 */
function prependHierarchy(name, prefix) {
  return prefix ? `${prefix}.${name}` : name;
}

/**
 * Removes a given namespace prefixed on a string.
 * @private
 * @param  {String} name   The event name/message
 * @param  {String} prefix The prefix to remove
 * @return {String}        The transformed string
 */
function removePrefix(name, prefix) {
  return prefix
    ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length)
    : name;
}

/**
 * Adds a listener to a specific part of an event's lifecycle.
 * @private
 * @this HotPress
 * @param {String} part The lifecycle part
 * @param {String} message The event name/message
 * @param {Function} fn The listener
 */
function onPart(part, message, fn) {
  message = prependHierarchy(message, this.prefix);
  fn._hpRemoved = false;
  getListenersFor.call(this, message)[part].push(fn);
}

/**
 * Adds a listener to a specific part of the event lifecycle and removes it
 * as soon as it's been called.
 * @private
 * @param {Function} subscribe The subscriber function
 * @param {String} message The event name/message
 * @param {Function} fn The listener
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
 * @private
 * @param {Number} timeout Timeout in milliseconds
 * @return {Promise} A promise that will be rejected within the given time
 */
function errorAfterMS(timeout) {
  return new Promise((_, reject) => setTimeout(
    () => reject(new HotPressTimeoutError(timeout)),
    timeout
  ));
}

/**
 * Subscribes emittion of an array of events to another event. All data will be
 * passed to the emittions.
 * @private
 * @this HotPress
 * @param {Function} subscribe The subscribing function
 * @param {String} message The event name/message
 * @param {String[]} triggers The list of event names to tirgger
 */
function triggersPart(subscribe, message, triggers) {
  subscribe(message, (_, ...data) => Promise.all(
    triggers.map(message => this.emit(message, ...data))
  ));
}

/**
 * Creates an emitter based on the event name/message and data. The emitter
 * can then be used to emit each part of the lifecycle.
 * @private
 * @this HotPress
 * @param {String} message The event name/message
 * @param {Any[]} data An array of data to pass to the listeners
 * @return {Function} The emitter
 */
function createEmitter(message, data) {
  const hierarchy = getHierarchy(message);
  const errorMessage = prependHierarchy(message, ERROR);

  const call = fn => Promise
    .resolve()
    .then(() => !fn._hpRemoved && fn(message, ...data));

  const promise = typeof this.timeout === 'undefined'
    ? fn => Promise.resolve(call(fn))
    : fn => Promise
        .race([errorAfterMS(this.timeout), call(fn)])
        .catch(error => emit.call(this, errorMessage, [error]));

  return part => Promise.all(flatten(
    hierarchy.map(message => (
      getListenersFor.call(this, message)[part].map(promise)
    ))
  ));
}

/**
 * Begin the event lifecycle for a given event and data.
 * @private
 * @this HotPress
 * @param {String} message The event name/message
 * @param {Any[]} data An array of data to pass to the listeners
 * @param {Number} timeout Optional amount of milliseconds to try each listener
 * @return {Promise} A promise that'll resolve once the lifecycle has completed
 */
function emit(message, data) {
  let emit = createEmitter.call(this, message, data);
  return this.lifecycle.reduce((promise, method) => (
    promise.then(() => emit(method))
  ), Promise.resolve());
}

/**
 * Finds and returns duplicates in an array.
 * @private
 * @param {Any[]} arr The array to search
 * @return {Any[]} An array of duplicates
 */
function findDuplicates(arr) {
  let dupCounts = arr.reduce((dupCounts, item) => Object.assign(dupCounts, {
    [item]: (dupCounts[item] || 0) + 1
  }), {});
  return Object.keys(dupCounts).filter(it => dupCounts[it] > 1);
}

/**
 * Removes a listener from a given event.
 * @private
 * @this HotPress
 * @param {String} message The event name/message
 * @param {Function} fn An optional listener to remove
 * @return {Number} The amount of listeners removed
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
 * @private
 * @param {String} message The event name/message
 * @return {Number} The amount of removed listeners
 */
function removeAllListeners(message) {
  let all = getAllListenersFor(message);
  let amount = all ? all.length : 0;
  all.forEach(listener => {
    listener._hpRemoved = true;
  });
  delete listeners[message];
  return amount;
}

/**
 * Returns a method name we may use to attach a single listener.
 * @private
 * @param {String} method  The method name
 * @return {String}        The singular method name
 */
function singularMethodName(method) {
  return method === ON ? 'once' : `once${upperFirst(method)}`;
}

/**
 * Returns a method name we may use as the trigger listener.
 * @private
 * @param {String} method  The method name
 * @return {String}        The trigger method name
 */
function triggerMethodName(method) {
  return method === ON ? 'triggers' : `triggers${upperFirst(method)}`;
}

/**
 * Fetches all the parts of the lifecycle before "on"
 * @private
 * @this HorPess
 * @return {String[]} The ordered lifecycle parts
 */
function startOfLifecycle() {
  return this.lifecycle.slice(0, this.lifecycle.indexOf(ON));
}

/**
 * Fetches all the parts of the lifecycle after "on"
 * @private
 * @this HotPress
 * @return {String[]} The ordered lifecycle parts
 */
function endOfLifecycle() {
  return this.lifecycle.slice(this.lifecycle.indexOf(ON) + 1);
}

/**
 * Returns all procedures within the current namespace
 * @private
 * @this HotPress
 * @return {Object} The procedures as name => fn
 */
function getProcedures() {
  return Object.keys(procedures).reduce((acc, name) => {
    if (name.startsWith(this.prefix)) {
      acc[removePrefix(name)] = procedures[name];
    }
    return acc;
  }, {});
}

/**
 * The exposable methods for each HotPress namespace.
 * @private
 * @prop {String}   prefix    The prefix to add to all messages
 * @prop {String[]} lifecycle The lifecycle list
 * @prop {Number}   timeout   Timeout to stop long processes
 * @param {String}   prefix    The namespace prefix
 * @param {String[]} lifecycle The lifecycle
 * @param {Number}   timeout   The timeout setting
 */
class HotPress {

  constructor(
    prefix = '',
    lifecycle = DEFAULT_LIFECYCLE,
    timeout = DEFAULT_TIMEOUT
  ) {
    this.prefix = prefix;
    this._lifecycle = [];
    this.lifecycle = lifecycle;
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
    return this._lifecycle.slice();
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

    _lifecycle.forEach(method => {
      delete this[method];
    });

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
   * @example
   * all({
   *   before: ['foo', 'bar'],
   *   on: ['another'],
   *   after: ['event']
   * }, ({foo, bar, another, event}) => {
   *   // You'll receive data for each event that fired
   * });
   * @param {Object}   messages An object of event names keyed by lifecycle parts
   * @param {Function} fn       The listener
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
   * @param  {String}   message The event name/message
   * @param  {Function} fn      An optional listener to search for
   * @return {Number}           The amount of listeners removed
   */
  off(message, fn) {
    message = prependHierarchy(message, this.prefix);
    return fn
      ? removeListener.call(this, message, fn)
      : removeAllListeners.call(this, message);
  }

  /**
   * Adds a listener to the end of the event lifecycle for just one emittion.
   * @param {String} message The event name/message
   * @param {...Any} data    Parameters to pass to the listeners
   * @return {Promise}       A promised resolved once the lifecycle has completed
   */
  emit(message, ...data) {
    message = prependHierarchy(message, this.prefix);
    return emit.call(this, message, data);
  }

  /**
   * Creates another version of hot press where all events are prefixed with
   * the given string.
   * @param  {String}    name The namespace
   * @return {HotPress}       A new version of HotPRess
   */
  ns(name) {
    let fullName = prependHierarchy(name, this.prefix);
    if (namespaces[fullName]) return namespaces[fullName];
    return name.split(HIERARCHY_SEPARATOR).reduce((parent, name) => {
      name = prependHierarchy(name, parent.prefix);
      namespaces[name] = namespaces[name] || new HotPress(
        name, parent.lifecycle, parent.timeout
      );
      return namespaces[name];
    }, this);
  }

  /**
   * Register a process to a name.
   * @param  {String}                         name The procedure name
   * @param  {Function}                       proc The procedure function
   * @throws {HotPressExistingProcedureError}
   */
  reg(name, proc) {
    name = prependHierarchy(name, this.prefix);
    proc._hpRemove = false;
    if (procedures[name]) throw new HotPressExistingProcedureError(name);
    procedures[name] = proc;
  }

  /**
   * Deregisters a process.
   * @param  {String} name The procedure name
   * @return {Number}      The amount of procedures removed
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
   * Deregesters all processes.
   * @return {Number} The amount of procedures removed
   */
  deregAll() {
    return Object
      .keys(getProcedures.call(this))
      .reduce((removed, name) => removed + this.dereg(name), 0);
  }

  /**
   * Calls a procedure and begins an event lifecycle too.
   * @param  {String} name The procedure name
   * @param  {...Any} data Parameters to pass to the listener
   * @return {Promise}     A promise resolved once the procedure has finished.
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
    let promise = startOfLifecycle
      .call(this)
      .reduce(lifecycleReducer, Promise.resolve());
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

/**
 * Timeout errors
 * @class HotPressTimeoutError
 * @extends Error
 * @param  {Number} ms The amount of milliseconds
 */
class HotPressTimeoutError extends Error {
  constructor(ms) {
    super(`Exceeded ${ms}ms`);
  }
}

/**
 * Error to be thrown when registering a procedure that has already been registerd.
 * @class HotPressExistingProcedureError
 * @extends Error
 * @param  {String} name The name of the procedure
 */
class HotPressExistingProcedureError extends Error {
  constructor(name) {
    super(`The procedure "${name}" is already registered`);
  }
}

/**
 * Error to be thrown when a trying to reference a non-existant procedure.
 * @class HotPressNonExistingProcedureError
 * @this HotPress
 * @extends Error
 * @param  {String} name The name of the procedure
 */
class HotPressNonExistingProcedureError extends Error {
  constructor(name) {
    super(`The procedure "${name}" doesn't exist`);
  }
}

module.exports = Object.assign(new HotPress(), {
  HotPressTimeoutError,
  HotPressExistingProcedureError,
  HotPressNonExistingProcedureError
});
