'use strict';

/**
 * Flattens an 2 dimensional array.
 * @private
 * @param {Any[]} arr - The array to flatten
 * @return {Any[]} The flattened array
 */
var flatten = function flatten(arr) {
  return arr.reduce(function (a, b) {
    return a.concat(b);
  }, []);
};

/**
 * Transforms the 1st character of a string to uppercase.
 * @private
 * @param {String} str - The string to manipulate.
 * @return {String} The transformed string.
 */
var upperFirst = function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

/**
 * String representing wildcards
 * @private
 * @type {String}
 */
var WILDCARD = '*';

/**
 * The error namespace
 * @private
 * @type {String}
 */
var ERROR = 'error';

/**
 * The "on" lifecycle part
 * @private
 * @type {String}
 */
var ON = 'on';

/**
 * What separates namespace hierarchy
 * @private
 * @type {String}
 */
var HIERARCHY_SEPARATOR = '.';

/**
 * The default lifecycle.
 * @private
 * @type {String[]}
 */
var DEFAULT_LIFECYCLE = ['before', ON, 'after'];

/**
 * The default timeout
 * @private
 * @type {Number}
 */
var DEFAULT_TIMEOUT = 300;

/**
 * @return {HotPress}
 */
function init() {
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
  var listeners = {};

  /**
   * Procedures referenced by the name.
   * [name]: Function
   * @type {Object}
   * @private
   */
  var procedures = {};

  /**
   * Namespaced HotPress instances.
   * @type {Object.<string, Function>}
   * @private
   */
  var namespaces = {};

  /**
   * Returns all the listeners for a given message. The returned value will be
   * an object whose keys are 'before', 'on' and 'after' of which each will
   * contain an array of functions/listeners.
   * @private
   * @param {String} message - The event name/message
   * @return {Object} The event listeners grouped by lifecycle parts
   * @this HotPress
   */
  function getListenersFor(message) {
    if (!listeners[message]) {
      listeners[message] = this.lifecycle.reduce(function (acc, method) {
        return Object.assign(acc, defineProperty({}, method, []));
      }, {});
    }
    return listeners[message];
  }

  /**
   * Returns version of all listeners on a particular event name/message.
   * @private
   * @param {String} message - The event name/message
   * @return {Function[]} An ordered array of listeners
   */
  var getAllListenersFor = function getAllListenersFor(message) {
    return Object.keys(listeners[message] || {}).reduce(function (acc, part) {
      return acc.concat(listeners[message][part]);
    }, []);
  };

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
  var getHierarchy = function getHierarchy(message) {
    var parts = message.split(HIERARCHY_SEPARATOR);
    var hierarchy = [WILDCARD];
    parts.reduce(function (message, part) {
      var prefix = message + HIERARCHY_SEPARATOR;
      hierarchy.unshift(prefix + WILDCARD);
      return prefix + part;
    });
    hierarchy.unshift(message);
    return hierarchy;
  };

  /**
   * Prepends an event name, if the string exists.
   * @private
   * @param {String} name - The event name/message
   * @param {String} prefix - The prefix to prepend
   * @return {String} The transformed string
   */
  var prependHierarchy = function prependHierarchy(name, prefix) {
    return prefix ? prefix + '.' + name : name;
  };

  /**
   * Removes a given namespace prefixed on a string.
   * @private
   * @param  {String} name   The event name/message
   * @param  {String} prefix The prefix to remove
   * @return {String}        The transformed string
   */
  var removePrefix = function removePrefix(name, prefix) {
    return prefix ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length) : name;
  };

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
   * @this HotPress
   */
  function oncePart(subscribe, message, fn) {
    var _this = this;

    var subscriber = function subscriber() {
      _this.off(message, subscriber);
      return fn.apply(undefined, arguments);
    };
    subscribe(message, subscriber);
  }

  /**
   * Create a promise and reject it in a given amount of milliseconds.
   * @private
   * @param {Number} timeout Timeout in milliseconds
   * @return {Promise} A promise that will be rejected within the given time
   */
  var errorAfterMS = function errorAfterMS(timeout) {
    return new Promise(function (resolve, reject) {
      return setTimeout(function () {
        return reject(new HotPressTimeoutError(timeout));
      }, timeout);
    });
  };

  /**
   * Subscribes emittion of an array of events to another event. All data will
   * be passed to the emittions.
   * @private
   * @this HotPress
   * @param {Function} subscribe The subscribing function
   * @param {String} message The event name/message
   * @param {String[]} triggers The list of event names to tirgger
   */
  function triggersPart(subscribe, message, triggers) {
    var _this2 = this;

    subscribe(message, function (_) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      return Promise.all(triggers.map(function (message) {
        return _this2.emit.apply(_this2, [message].concat(data));
      }));
    });
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
    var _this3 = this;

    var hierarchy = getHierarchy(message);
    var errorMessage = prependHierarchy(message, ERROR);

    var call = function call(fn) {
      return Promise.resolve().then(function () {
        return !fn._hpRemoved && fn.apply(undefined, [message].concat(toConsumableArray(data)));
      });
    };

    var promise = typeof this.timeout === 'undefined' ? function (fn) {
      return Promise.resolve(call(fn));
    } : function (fn) {
      return Promise.race([errorAfterMS(_this3.timeout), call(fn)]).catch(function (error) {
        return _emit.call(_this3, errorMessage, [error]);
      });
    };

    return function (part) {
      return Promise.all(flatten(hierarchy.map(function (message) {
        return getListenersFor.call(_this3, message)[part].map(promise);
      })));
    };
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
  function _emit(message, data) {
    var emit = createEmitter.call(this, message, data);
    return this.lifecycle.reduce(function (promise, method) {
      return promise.then(function () {
        return emit(method);
      });
    }, Promise.resolve());
  }

  /**
   * Finds and returns duplicates in an array.
   * @private
   * @param {Any[]} arr The array to search
   * @return {Any[]} An array of duplicates
   */
  var findDuplicates = function findDuplicates(arr) {
    var dupCounts = arr.reduce(function (dupCounts, item) {
      return Object.assign(dupCounts, defineProperty({}, item, (dupCounts[item] || 0) + 1));
    }, {});
    return Object.keys(dupCounts).filter(function (it) {
      return dupCounts[it] > 1;
    });
  };

  /**
   * Removes a listener from a given event.
   * @private
   * @this HotPress
   * @param {String} message The event name/message
   * @param {Function} fn An optional listener to remove
   * @return {Number} The amount of listeners removed
   */
  function removeListener(message, fn) {
    var listeners = getListenersFor.call(this, message);
    var removed = 0;
    for (var key in listeners) {
      var set$$1 = listeners[key];
      var index = set$$1.indexOf(fn);
      if (index !== -1) {
        set$$1[index]._hpRemoved = true;
        set$$1.splice(index, 1);
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
  var removeAllListeners = function removeAllListeners(message) {
    var all = getAllListenersFor(message);
    var amount = all ? all.length : 0;
    all.forEach(function (listener) {
      listener._hpRemoved = true;
    });
    delete listeners[message];
    return amount;
  };

  /**
   * Returns a method name we may use to attach a single listener.
   * @private
   * @param {String} method  The method name
   * @return {String}        The singular method name
   */
  var singularMethodName = function singularMethodName(method) {
    return method === ON ? 'once' : 'once' + upperFirst(method);
  };

  /**
   * Returns a method name we may use as the trigger listener.
   * @private
   * @param {String} method  The method name
   * @return {String}        The trigger method name
   */
  var triggerMethodName = function triggerMethodName(method) {
    return method === ON ? 'triggers' : 'triggers' + upperFirst(method);
  };

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
    var _this4 = this;

    return Object.keys(procedures).reduce(function (acc, name) {
      if (name.startsWith(_this4.prefix)) {
        acc[removePrefix(name)] = procedures[name];
      }
      return acc;
    }, {});
  }

  /**
   * The exposable methods for each HotPress namespace.
   * @private
   * @prop {String}   prefix    The prefix to add to all messages
   * @prop {Number}   timeout   Timeout to stop long processes
   */

  var HotPress = function () {
    /**
     * @constructor
     * @param {String}   prefix    The namespace prefix
     * @param {String[]} lifecycle The lifecycle
     * @param {Number}   timeout   The timeout setting
     */
    function HotPress() {
      var prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var lifecycle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_LIFECYCLE;
      var timeout = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : DEFAULT_TIMEOUT;
      classCallCheck(this, HotPress);

      this.prefix = prefix;
      this._lifecycle = [];
      this.lifecycle = lifecycle;
      this.timeout = timeout;
      this.all = this.all.bind(this);
      this.call = this.call.bind(this);
      this.dereg = this.dereg.bind(this);
      this.deregAll = this.deregAll.bind(this);
      this.emit = this.emit.bind(this);
      this.ns = this.ns.bind(this);
      this.off = this.off.bind(this);
      this.reg = this.reg.bind(this);
    }

    /**
     * @prop {String[]} lifecycle The lifecycle list
     */


    createClass(HotPress, [{
      key: 'all',


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
      value: function all(messages, fn) {
        var _this5 = this;

        var toDo = void 0;
        var dataCollection = void 0;
        var size = Object.keys(messages).reduce(function (size, part) {
          return size + messages[part].length;
        }, 0);

        var subscriber = function subscriber(message) {
          for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            data[_key2 - 1] = arguments[_key2];
          }

          dataCollection[message] = data;
          toDo--;
          if (!toDo) {
            fn(dataCollection);
            init();
          }
        };

        var registerSubscribers = function registerSubscribers(prop, method) {
          if (messages[prop]) {
            messages[prop].forEach(function (message) {
              method(message, subscriber);
            });
          }
        };

        var init = function init() {
          toDo = size;
          dataCollection = {};
          _this5.lifecycle.forEach(function (method) {
            registerSubscribers(method, _this5[singularMethodName(method)]);
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

    }, {
      key: 'off',
      value: function off(message, fn) {
        message = prependHierarchy(message, this.prefix);
        return fn ? removeListener.call(this, message, fn) : removeAllListeners.call(this, message);
      }

      /**
       * Adds a listener to the end of the event lifecycle for just one emittion.
       * @param {String} message The event name/message
       * @param {...Any} data    Parameters to pass to the listeners
       * @return {Promise}       A promised resolved once the lifecycle has
       *                         completed
       */

    }, {
      key: 'emit',
      value: function emit(message) {
        message = prependHierarchy(message, this.prefix);

        for (var _len3 = arguments.length, data = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
          data[_key3 - 1] = arguments[_key3];
        }

        return _emit.call(this, message, data);
      }

      /**
       * Creates another version of hot press where all events are prefixed with
       * the given string.
       * @param  {String}    name The namespace
       * @return {HotPress}       A new version of HotPRess
       */

    }, {
      key: 'ns',
      value: function ns(name) {
        var fullName = prependHierarchy(name, this.prefix);
        if (namespaces[fullName]) return namespaces[fullName];
        return name.split(HIERARCHY_SEPARATOR).reduce(function (parent, name) {
          name = prependHierarchy(name, parent.prefix);
          namespaces[name] = namespaces[name] || new HotPress(name, parent.lifecycle, parent.timeout);
          return namespaces[name];
        }, this);
      }

      /**
       * Register a process to a name.
       * @param  {String}                         name The procedure name
       * @param  {Function}                       proc The procedure function
       * @throws {HotPressExistingProcedureError}
       */

    }, {
      key: 'reg',
      value: function reg(name, proc) {
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

    }, {
      key: 'dereg',
      value: function dereg(name) {
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

    }, {
      key: 'deregAll',
      value: function deregAll() {
        var _this6 = this;

        return Object.keys(getProcedures.call(this)).reduce(function (removed, name) {
          return removed + _this6.dereg(name);
        }, 0);
      }

      /**
       * Calls a procedure and begins an event lifecycle too.
       * @param  {String} name The procedure name
       * @param  {...Any} data Parameters to pass to the listener
       * @return {Promise}     A promise resolved once the procedure has finished.
       */

    }, {
      key: 'call',
      value: function call(name) {
        for (var _len4 = arguments.length, data = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
          data[_key4 - 1] = arguments[_key4];
        }

        var result = void 0;

        name = prependHierarchy(name, this.prefix);

        var emit = createEmitter.call(this, name, data);

        var lifecycleReducer = function lifecycleReducer(promise, method) {
          return promise.then(function () {
            return emit(method);
          });
        };

        var proc = procedures[name] || function () {
          throw new HotPressNonExistingProcedureError(name);
        };

        var promise = startOfLifecycle.call(this).reduce(lifecycleReducer, Promise.resolve()).then(function () {
          return Promise.all([!proc._hpRemoved && proc.apply(undefined, data), emit(ON)]);
        }).then(function (_ref) {
          var _ref2 = slicedToArray(_ref, 1),
              r = _ref2[0];

          result = r;
        });

        return endOfLifecycle.call(this).reduce(lifecycleReducer, promise).then(function () {
          return result;
        });
      }
    }, {
      key: 'lifecycle',
      get: function get$$1() {
        return this._lifecycle.slice();
      }

      /**
       * Lifecycle setter
       * @param {String[]} lifecycle The lifecycle list
       */
      ,
      set: function set$$1(lifecycle) {
        var _this7 = this;

        var _lifecycle = this._lifecycle;

        var duplicates = findDuplicates(lifecycle);
        this._lifecycle = lifecycle;

        if (duplicates.length) {
          throw new Error('Lifecycle contains duplicates (' + duplicates + ')');
        }

        if (!~lifecycle.indexOf(ON)) {
          throw new Error('Lifecycle (' + lifecycle + ') must contain an "on" method');
        }

        _lifecycle.forEach(function (method) {
          delete _this7[method];
        });

        lifecycle.forEach(function (method) {
          var singularName = singularMethodName(method);
          var triggersName = triggerMethodName(method);
          var singularTriggersName = triggerMethodName(singularName);

          _this7[method] = onPart.bind(_this7, method);
          _this7[singularName] = oncePart.bind(_this7, _this7[method]);
          _this7[triggersName] = triggersPart.bind(_this7, _this7[method]);
          _this7[singularTriggersName] = triggersPart.bind(_this7, _this7[singularName]);
        });
      }
    }]);
    return HotPress;
  }();

  return new HotPress();
}

/**
 * Timeout errors
 * @class HotPressTimeoutError
 * @extends Error
 * @param  {Number} ms The amount of milliseconds
 */

var HotPressTimeoutError = function (_Error) {
  inherits(HotPressTimeoutError, _Error);

  /**
   * @constructor
   * @param {Number} ms The milliseconds that exceeded to cause the timeout
   */
  function HotPressTimeoutError(ms) {
    classCallCheck(this, HotPressTimeoutError);
    return possibleConstructorReturn(this, (HotPressTimeoutError.__proto__ || Object.getPrototypeOf(HotPressTimeoutError)).call(this, 'Exceeded ' + ms + 'ms'));
  }

  return HotPressTimeoutError;
}(Error);

/**
 * Error to be thrown when registering a procedure that has already been
 * registerd.
 * @class HotPressExistingProcedureError
 * @extends Error
 * @param  {String} name The name of the procedure
 */


var HotPressExistingProcedureError = function (_Error2) {
  inherits(HotPressExistingProcedureError, _Error2);

  /**
   * @constructor
   * @param {String} name The name of the procedure
   */
  function HotPressExistingProcedureError(name) {
    classCallCheck(this, HotPressExistingProcedureError);
    return possibleConstructorReturn(this, (HotPressExistingProcedureError.__proto__ || Object.getPrototypeOf(HotPressExistingProcedureError)).call(this, 'The procedure "' + name + '" is already registered'));
  }

  return HotPressExistingProcedureError;
}(Error);

/**
 * Error to be thrown when a trying to reference a non-existant procedure.
 * @class HotPressNonExistingProcedureError
 * @this HotPress
 * @extends Error
 * @param  {String} name The name of the procedure
 */


var HotPressNonExistingProcedureError = function (_Error3) {
  inherits(HotPressNonExistingProcedureError, _Error3);

  /**
   * @constructor
   * @param {String} name The name of the procedure
   */
  function HotPressNonExistingProcedureError(name) {
    classCallCheck(this, HotPressNonExistingProcedureError);
    return possibleConstructorReturn(this, (HotPressNonExistingProcedureError.__proto__ || Object.getPrototypeOf(HotPressNonExistingProcedureError)).call(this, 'The procedure "' + name + '" doesn\'t exist'));
  }

  return HotPressNonExistingProcedureError;
}(Error);

var hotPress = Object.assign(init, {
  HotPressTimeoutError: HotPressTimeoutError,
  HotPressExistingProcedureError: HotPressExistingProcedureError,
  HotPressNonExistingProcedureError: HotPressNonExistingProcedureError
});

module.exports = hotPress;
