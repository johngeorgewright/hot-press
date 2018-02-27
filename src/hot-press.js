import {errorAfterMS, findDuplicates, flatten, upperFirst} from './util'
import HotPressExistingProcedureError from './hot-press-existing-procedure-error'
import HotPressNonExistingProcedureError from './hot-press-non-existing-procedure-error'

/**
 * String representing wildcards
 * @private
 * @type {String}
 */
const WILDCARD = '*'

/**
 * The error namespace
 * @private
 * @type {String}
 */
const ERROR = 'error'

/**
 * The "on" lifecycle part
 * @private
 * @type {String}
 */
const ON = 'on'

/**
 * What separates namespace hierarchy
 * @private
 * @type {String}
 */
const HIERARCHY_SEPARATOR = '.'

/**
 * The default lifecycle.
 * @private
 * @type {String[]}
 */
const DEFAULT_LIFECYCLE = ['before', ON, 'after']

/**
 * The default timeout
 * @private
 * @type {Number}
 */
const DEFAULT_TIMEOUT = 300

/**
 * Returns a list of messages that should be called in order for a specific
 * message.
 * @private
 * @example
 * getHierarchy('a.b.c.d')
 * // ==> ['a.b.c.d', 'a.b.c.*', 'a.b.*', 'a.*', '*']
 * @param {String} message - The event name/message
 * @return {String[]} The ordered list of messages that should be called
 */
const getHierarchy = message => {
  const parts = message.split(HIERARCHY_SEPARATOR)
  const hierarchy = [WILDCARD]
  parts.reduce((message, part) => {
    const prefix = message + HIERARCHY_SEPARATOR
    hierarchy.unshift(prefix + WILDCARD)
    return prefix + part
  })
  hierarchy.unshift(message)
  return hierarchy
}

/**
 * Prepends an event name, if the string exists.
 * @private
 * @param {String} name - The event name/message
 * @param {String} prefix - The prefix to prepend
 * @return {String} The transformed string
 */
const prependHierarchy = (name, prefix) =>
  prefix ? `${prefix}.${name}` : name

/**
 * Removes a given namespace prefixed on a string.
 * @private
 * @param  {String} name   The event name/message
 * @param  {String} prefix The prefix to remove
 * @return {String}        The transformed string
 */
const removePrefix = (name, prefix) =>
  prefix
    ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length)
    : name

/**
 * Returns a method name we may use to attach a single listener.
 * @private
 * @param {String} method  The method name
 * @return {String}        The singular method name
 */
const singularMethodName = method =>
  method === ON ? 'once' : `once${upperFirst(method)}`

/**
 * Returns a method name we may use as the trigger listener.
 * @private
 * @param {String} method  The method name
 * @return {String}        The trigger method name
 */
const triggerMethodName = method =>
  method === ON ? 'triggers' : `triggers${upperFirst(method)}`

const $lifecycle = Symbol('lifecycle')
const $listeners = Symbol('listeners')
const $procedures = Symbol('procedures')
const $namespaces = Symbol('namespaces')
const $getListenersFor = Symbol('getListenersFor')
const $getAllListenersFor = Symbol('getAllListenersFor')
const $triggersPart = Symbol('triggersPart')
const $onPart = Symbol('onPart')
const $oncePart = Symbol('oncePart')
const $createEmitter = Symbol('createEmitter')
const $emit = Symbol('emit')
const $removeListener = Symbol('removeListener')
const $removeAllListeners = Symbol('removeAllListeners')
const $startOfLifecycle = Symbol('startOfLifecycle')
const $endOfLifecycle = Symbol('endOfLifecycle')
const $getProcedures = Symbol('getProcedures')

/**
 * The exposable methods for each HotPress namespace.
 * @private
 * @prop {String}   prefix    The prefix to add to all messages
 * @prop {Number}   timeout   Timeout to stop long processes
 */
export default class HotPress {
  /**
   * @constructor
   * @param {String}   prefix    The namespace prefix
   * @param {String[]} lifecycle The lifecycle
   * @param {Number}   timeout   The timeout setting
   */
  constructor (
    prefix = '',
    lifecycle = DEFAULT_LIFECYCLE,
    timeout = DEFAULT_TIMEOUT,
    listeners = {},
    procedures = {},
    namespaces = {}
  ) {
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
    this[$listeners] = listeners

    /**
     * Procedures referenced by the name.
     * [name]: Function
     * @type {Object}
     * @private
     */
    this[$procedures] = procedures

    /**
     * Namespaced HotPress instances.
     * @type {Object.<string, Function>}
     * @private
     */
    this[$namespaces] = namespaces

    this.prefix = prefix
    this[$lifecycle] = []
    this.lifecycle = lifecycle
    this.timeout = timeout
    this.all = this.all.bind(this)
    this.call = this.call.bind(this)
    this.dereg = this.dereg.bind(this)
    this.deregAll = this.deregAll.bind(this)
    this.emit = this.emit.bind(this)
    this.ns = this.ns.bind(this)
    this.off = this.off.bind(this)
    this.reg = this.reg.bind(this)
  }

  /**
   * @prop {String[]} lifecycle The lifecycle list
   */
  get lifecycle () {
    return this[$lifecycle].slice()
  }

  /**
   * Lifecycle setter
   * @param {String[]} lifecycle The lifecycle list
   */
  set lifecycle (lifecycle) {
    const _lifecycle = this[$lifecycle]
    const duplicates = findDuplicates(lifecycle)
    this[$lifecycle] = lifecycle

    if (duplicates.length) {
      throw new Error(`Lifecycle contains duplicates (${duplicates})`)
    }

    if (!~lifecycle.indexOf(ON)) {
      throw new Error(`Lifecycle (${lifecycle}) must contain an "on" method`)
    }

    _lifecycle.forEach(method => {
      delete this[method]
    })

    lifecycle.forEach(method => {
      const singularName = singularMethodName(method)
      const triggersName = triggerMethodName(method)
      const singularTriggersName = triggerMethodName(singularName)

      this[method] = this[$onPart].bind(this, method)
      this[singularName] = this[$oncePart].bind(this, this[method])
      this[triggersName] = this[$triggersPart].bind(this, this[method])
      this[singularTriggersName] = this[$triggersPart].bind(this, this[singularName])
    })
  }

  /**
   * Returns all the listeners for a given message. The returned value will be
   * an object whose keys are 'before', 'on' and 'after' of which each will
   * contain an array of functions/listeners.
   * @private
   * @param {String} message - The event name/message
   * @return {Object} The event listeners grouped by lifecycle parts
   * @this HotPress
   */
  [$getListenersFor] (message) {
    if (!this[$listeners][message]) {
      this[$listeners][message] = this.lifecycle.reduce(
        (acc, method) => ({...acc, [method]: []}),
        {}
      )
    }
    return this[$listeners][message]
  }

  /**
   * Returns version of all listeners on a particular event name/message.
   * @private
   * @param {String} message - The event name/message
   * @return {Function[]} An ordered array of listeners
   */
  [$getAllListenersFor] (message) {
    return Object
      .keys(this[$listeners][message] || {})
      .reduce((acc, part) => [...acc, ...this[$listeners][message][part]], [])
  }

  /**
   * Adds a listener to a specific part of an event's lifecycle.
   * @private
   * @this HotPress
   * @param {String} part The lifecycle part
   * @param {String} message The event name/message
   * @param {Function} fn The listener
   */
  [$onPart] (part, message, fn) {
    message = prependHierarchy(message, this.prefix)
    fn._hpRemoved = false
    this[$getListenersFor](message)[part].push(fn)
  }

  /**
   * Adds a listener to a specific part of the event lifecycle and removes it
   * as soon as it's been called.
   * @private
   * @param {Function} subscribe The subscriber function
   * @param {String} message The event name/message
   * @param {Function} fn The listener
   * @this HotPress
   */
  [$oncePart] (subscribe, message, fn) {
    const subscriber = (...args) => {
      this.off(message, subscriber)
      return fn(...args)
    }
    subscribe(message, subscriber)
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
  [$createEmitter] (message, data) {
    const hierarchy = getHierarchy(message)
    const errorMessage = prependHierarchy(message, ERROR)

    const call = fn => Promise
      .resolve()
      .then(() => !fn._hpRemoved && fn(message, ...data))

    const promise = typeof this.timeout === 'undefined'
      ? fn => Promise.resolve(call(fn))
      : fn => Promise
        .race([errorAfterMS(this.timeout), call(fn)])
        .catch(error => this[$emit](errorMessage, [error]))

    return part => Promise.all(flatten(
      hierarchy.map(message => (
        this[$getListenersFor](message)[part].map(promise)
      ))
    ))
  }

  /**
   * Begin the event lifecycle for a given event and data.
   * @private
   * @this HotPress
   * @param {String} message The event name/message
   * @param {Any[]} data An array of data to pass to the listeners
   * @param {Number} timeout Optional amount of milliseconds to try each
   * listener
   * @return {Promise} A promise that'll resolve once the lifecycle has
   * completed
   */
  [$emit] (message, data) {
    const emit = this[$createEmitter](message, data)
    return this.lifecycle.reduce(
      (promise, method) => promise.then(() => emit(method)),
      Promise.resolve()
    )
  }

  /**
   * Removes a listener from a given event.
   * @private
   * @this HotPress
   * @param {String} message The event name/message
   * @param {Function} fn An optional listener to remove
   * @return {Number} The amount of listeners removed
   */
  [$removeListener] (message, fn) {
    const listeners = this[$getListenersFor](message)
    let removed = 0
    for (const key in listeners) {
      const set = listeners[key]
      const index = set.indexOf(fn)
      if (index !== -1) {
        set[index]._hpRemoved = true
        set.splice(index, 1)
        removed++
        break
      }
    }
    return removed
  }

  /**
   * Removes all listeners from a given event.
   * @private
   * @param {String} message The event name/message
   * @return {Number} The amount of removed listeners
   */
  [$removeAllListeners] (message) {
    const all = this[$getAllListenersFor](message)
    const amount = all ? all.length : 0
    all.forEach(listener => {
      listener._hpRemoved = true
    })
    delete this[$listeners][message]
    return amount
  }

  /**
   * Fetches all the parts of the lifecycle before "on"
   * @private
   * @this HorPess
   * @return {String[]} The ordered lifecycle parts
   */
  [$startOfLifecycle] () {
    return this.lifecycle.slice(0, this.lifecycle.indexOf(ON))
  }

  /**
   * Fetches all the parts of the lifecycle after "on"
   * @private
   * @this HotPress
   * @return {String[]} The ordered lifecycle parts
   */
  [$endOfLifecycle] () {
    return this.lifecycle.slice(this.lifecycle.indexOf(ON) + 1)
  }

  /**
   * Returns all procedures within the current namespace
   * @private
   * @this HotPress
   * @return {Object} The procedures as name => fn
   */
  [$getProcedures] () {
    return Object.keys(this[$procedures]).reduce(
      (acc, name) => {
        if (name.startsWith(this.prefix)) {
          acc[removePrefix(name)] = this[$procedures][name]
        }
        return acc
      },
      {}
    )
  }

  /**
   * Subscribes emittion of an array of events to another event. All data will
   * be passed to the emittions.
   * @private
   * @this HotPress
   * @param {Function} subscribe The subscribing function
   * @param {String} message The event name/message
   * @param {String[]} triggers The list of event names to tirgger
   */
  [$triggersPart] (subscribe, message, triggers) {
    subscribe(message, (_, ...data) => Promise.all(
      triggers.map(message => this.emit(message, ...data))
    ))
  }

  /**
   * Will call the listener once each of the specified events have been
   * emitted. The events are given as an object, where each key will specify
   * the part of the event lifecycle and the value is an array of event
   * names/messages.
   * @example
   * all({
   *   before: ['foo', 'bar'],
   *   on: ['another'],
   *   after: ['event']
   * }, ({foo, bar, another, event}) => {
   *   // You'll receive data for each event that fired
   * })
   * @param {Object}   messages An object of event names keyed by lifecycle
   *                   parts
   * @param {Function} fn       The listener
   */
  all (messages, fn) {
    let toDo
    let dataCollection
    const size = Object
      .keys(messages)
      .reduce((size, part) => size + messages[part].length, 0)

    const subscriber = (message, ...data) => {
      dataCollection[message] = data
      toDo--
      if (!toDo) {
        fn(dataCollection)
        init()
      }
    }

    const registerSubscribers = (prop, method) => {
      if (messages[prop]) {
        messages[prop].forEach(message => {
          method(message, subscriber)
        })
      }
    }

    const init = () => {
      toDo = size
      dataCollection = {}
      this.lifecycle.forEach(method => {
        registerSubscribers(method, this[singularMethodName(method)])
      })
    }

    init()
  }

  /**
   * Removes the specified listener from a given event. If no listener is
   * specified, all will be removed.
   * @param  {String}   message The event name/message
   * @param  {Function} fn      An optional listener to search for
   * @return {Number}           The amount of listeners removed
   */
  off (message, fn) {
    message = prependHierarchy(message, this.prefix)
    return fn
      ? this[$removeListener](message, fn)
      : this[$removeAllListeners](message)
  }

  /**
   * Adds a listener to the end of the event lifecycle for just one emittion.
   * @param {String} message The event name/message
   * @param {...Any} data    Parameters to pass to the listeners
   * @return {Promise}       A promised resolved once the lifecycle has
   *                         completed
   */
  emit (message, ...data) {
    message = prependHierarchy(message, this.prefix)
    return this[$emit](message, data)
  }

  /**
   * Creates another version of hot press where all events are prefixed with
   * the given string.
   * @param  {String}    name The namespace
   * @return {HotPress}       A new version of HotPress
   */
  ns (name) {
    const fullName = prependHierarchy(name, this.prefix)
    if (this[$namespaces][fullName]) return this[$namespaces][fullName]
    return name.split(HIERARCHY_SEPARATOR).reduce(
      (parent, name) => {
        name = prependHierarchy(name, parent.prefix)
        this[$namespaces][name] = this[$namespaces][name] || new HotPress(
          name, parent.lifecycle, parent.timeout,
          this[$listeners], this[$procedures], this[$namespaces]
        )
        return this[$namespaces][name]
      },
      this
    )
  }

  /**
   * Register a process to a name.
   * @param  {String}                         name The procedure name
   * @param  {Function}                       proc The procedure function
   * @throws {HotPressExistingProcedureError}
   */
  reg (name, proc) {
    name = prependHierarchy(name, this.prefix)
    proc._hpRemove = false
    if (this[$procedures][name]) throw new HotPressExistingProcedureError(name)
    this[$procedures][name] = proc
  }

  /**
   * Deregisters a process.
   * @param  {String} name The procedure name
   * @return {Number}      The amount of procedures removed
   */
  dereg (name) {
    name = prependHierarchy(name, this.prefix)
    if (this[$procedures][name]) {
      this[$procedures][name]._hpRemoved = true
      delete this[$procedures][name]
      return 1
    }
    return 0
  }

  /**
   * Deregesters all processes.
   * @return {Number} The amount of procedures removed
   */
  deregAll () {
    return Object
      .keys(this[$getProcedures]())
      .reduce((removed, name) => removed + this.dereg(name), 0)
  }

  /**
   * Calls a procedure and begins an event lifecycle too.
   * @param  {String} name The procedure name
   * @param  {...Any} data Parameters to pass to the listener
   * @return {Promise}     A promise resolved once the procedure has finished.
   */
  call (name, ...data) {
    let result

    name = prependHierarchy(name, this.prefix)

    const emit = this[$createEmitter](name, data)

    const lifecycleReducer = (promise, method) =>
      promise.then(() => emit(method))

    const proc = this[$procedures][name] || (() => {
      throw new HotPressNonExistingProcedureError(name)
    })

    const promise = this[$startOfLifecycle]()
      .reduce(lifecycleReducer, Promise.resolve())
      .then(() => Promise.all([
        !proc._hpRemoved && proc(...data),
        emit(ON)
      ]))
      .then(([r]) => {
        result = r
      })

    return this[$endOfLifecycle]()
      .reduce(lifecycleReducer, promise)
      .then(() => result)
  }
}
