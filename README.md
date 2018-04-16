<img src="https://raw.githubusercontent.com/johngeorgewright/hot-press/master/logo.png" align="right" />

# Hot Press

[![Coverage Status](https://img.shields.io/coveralls/johngeorgewright/hot-press/master.svg?style=flat-square)](https://coveralls.io/github/johngeorgewright/hot-press?branch=master)
[![Build Status](https://img.shields.io/travis/johngeorgewright/hot-press/master.svg?style=flat-square)](https://travis-ci.org/johngeorgewright/hot-press)
[![NPM Version](https://img.shields.io/npm/v/hot-press.svg?style=flat-square)](https://www.npmjs.com/package/hot-press)
[![Greenkeeper badge](https://badges.greenkeeper.io/johngeorgewright/hot-press.svg)](https://greenkeeper.io/)
[![License](https://img.shields.io/npm/l/hot-press.svg?style=flat-square)](https://github.com/johngeorgewright/hot-press/blob/master/LICENSE)

Hot Press is an event lifecycle management library for Node.js.

## Installation

```
npm i hot-press
```

## Examples

### Standard PubSub

Basic PubSub architecture we're mostly familiar with. Using the `on()` function,
you can add subscribers to events that are published using the `emit()`
function.

```javascript
import HotPress from 'hot-press';

const {emit, on} = new HotPress();
on('event', (eventName, ...data) => console.log(...data));
emit('event', 'some', 'variables');
// 'some' 'variables'
```

### Subscribing to multiple events

Using the `all` function you can trigger a subscriber only once all the events
have been emitted.

```javascript
import HotPress from 'hot-press';

const {all, emit} = new HotPress();
all({on: ['event1', 'event2']}, () => console.log('Triggered!'));
emit('event1');
emit('event2');
// 'Triggered!'
```

### Subscription hierarchy

Dots symbolize subscription hierarchy. Using the `*` operator, you can subscribe
to all events under that hierarchy.

```javascript
import HotPress from 'hot-press';

const {emit, on} = new HotPress();
on('*', e => console.log(2, e));
on('e.*', e => console.log(1, e));
emit('e.f');
// 1 e.f
// 2 e.f
```

### Unsubscribe

Remove all or specific subscribers from events using the `off()` function.

```javascript
import HotPress from 'hot-press';

const {emit, off, on} = new HotPress();
const fn = () => console.log('blah');

on('event', fn);
on('event', fn);
on('event', fn);

emit('event');
// blah
// blah
// blah

off('event', fn);
emit('event');
// blah
// blah

off('event');
emit('event');
// <nothing happens>
```

### Subscribing to the beginning and end of events

There are 3 parts to an event lifecycle.

1. "Before" the event
2. "On" the event
3. "After" the event

You can subscribe to any part of the event lifecycle using the appropriate
function.

```javascript
import HotPress from 'hot-press';

const {after, before, emit, off, on} = new HotPress();
before('event', () => console.log(1));
on('event', () => console.log(2));
after('event', () => console.log(3));
emit('event');
// 1
// 2
// 3
off('event');

after('event', () => console.log(3));
before('event', () => console.log(1));
on('event', () => console.log(2));
emit('event');
// 1
// 2
// 3
```

### Asynchronous subscriptions

If your subscription returns a Promise then the next part of the event lifecycle
will not be published until the promise has resolved.

> **Note:** It will not delay subscriptions within the same part of the lifecycle,
> only those that are to be published next. For example, all subscriptions
> implemented with the `on()` function will wait until all subscriptions
> implemented with the `before()` function have been resolved.

And finally the `emit` function will return a promise that will resolve once
the "after" part of the lifecycle has resolved.

```javascript
import HotPress from 'hot-press';

const {after, before, emit, on} = new HotPress();
before('event', eventuallyLog(1));
on('event', eventuallyLog(2));
after('event', eventuallyLog(3));
emit('event').then(() => console.log(4));
// 1
// 2
// 3
// 4

function eventuallyLog(num) {
  return () => new Promise(resolve => {
    const log = () => {
      console.log(num);
      resolve();
    };
    setTimeout(log, random());
  });
}

function random(from=0, to=1000) {
  return Math.floor(Math.random() * to) + from;
}
```

#### Timeouts

There is a configurable timeout for these asynchronous events. By default it's
300ms, but it can be configured like so:

```javascript
import HotPress from 'hot-press';

const emitter = new HotPress();
emitter.timeout = 1000; // global
emitter.ns('myNamespace').timeout = 600; // specific to a namespace
```

If the timeout is exceeded by a listener within any part of event lifecycle, the
listener is terminated and an error event is published; it will not kill the
event.

### Namespacing

You can create a version of hot-press prefixing all messages with a namespace.

```javascript
import HotPress from 'hot-press';
import {strictEqual} from 'assert';

const {ns} = new HotPress();
const foo = ns('foo');

foo.on('event', eventName => console.log(eventName));
foo.emit('event');
// foo.event
```

Namespaces can be retrieved uses the dot syntax, or chained `ns()` calls.

```javascript
import HotPress from 'hot-press';
import {strictEqual} from 'assert';

const {ns} = new HotPress();
strictEqual(
  ns('nested').ns('namespaces'),
  ns('nested.namespaces'),
  'Namespaces can be retrieved using dots as hierarchy, or chained calls to `ns`'
);
```

Namespaces also cascade their settings.

```javascript
import HotPress from 'hot-press';
import {equal} from 'assert';

const {ns} = new HotPress();
const foo = ns('foo');
foo.timeout = 1000;

equal(
  foo.timeout,
  foo.ns('bar').timeout,
  'Namespaces cascade their settings'
);
```

### Error handling

Errors thrown within listeners/subscribers are swallowed but can be captured in
error events:

```javascript
import HotPress from 'hot-press';

const {emit, on} = new HotPress();
on('error.event', error => console.log(error.message));
on('event', () => throw new Error('Something went wrong'));
emit('event');
// "Something went wrong"
```

### Procedures

Procedures are essentially functions, referenced by a string. There are a few
reasons you may want to use procedures:

- Whether the procedure exists or not, you can call it without anything
  failing. This is useful when using procedures in a plugable interface, when
  you're unsure whether the procedure is going to be there or not.
- Hooking in to the function call. Every call to a procedure emits an event
  with the same name as the procedure. The event lifecycle will exist, which
  also means you can pause the call with the `before()` method.
- If you've decided to use HotPress as a basis to your framework/application
  it can mean your API is more consistent.

To register a procedure, use the `reg()` function. To cal your registered
procedure, use the `call()` method.

If the procedure returns a promise, it will wait for the promise to resolve
before passing the resolved data back to the caller.

The `call()` function always returns a promise.

```javascript
import User from '../lib/user';
import HotPress from 'hot-press';

const {reg, call, on} = new HotPress();

reg('users.get', query => User.all(query));

on('error.users.get', error => console.error(error));

on('users.get', query => console.log('Querying users table', query));

call('users.get', {type: 'admin'}).then(users => {
  // Do something with users
});
```

## Custom Lifecycles

The `before()`, `on()` & `after()` methods don't suffice everyone's needs.
Luckily enough, for those people, the lifecycle is configurable.

> **Note** you must still include an `on` method. Procedures rely on it.

```javascript
import HotPress from 'hot-press';

const emitter = new HotPress();
emitter.lifecycle = ['foo', 'bar', 'on', 'after'];
const {foo, bar, on, after, emit} = emitter;

foo('event', console.log);
bar('event', console.log);
on('event', console.log);
after('event', console.log);

emit('event');
// foo
// bar
// on
// after
```

The lifecycle is configurable per namespace too.

```javascript
import HotPress from 'hot-press';

const {ns} = new HotPress();
const foo = ns('foo');
foo.lifecycle = ['prior', 'on', 'end'];

foo.prior('event', console.log);
foo.on('event', console.log);
foo.end('event', console.log);
foo.emit('event');
// prior
// on
// end
```

## Why the weird name?

Mostly because the good ones were already taken and there's arguably a relation
between publishing/subscribing to magazines and papers.

## API

### `after(String eventName, Function subscriber)`

Register a subscribing function to the end of the event.

### `all(Object<[lifecycleName]: String[]> eventNames, Function subscriber)`

Register a subscriber for when all events have been published

### `call(String procedureName, [...Any]) ==> Promise`

Call a procedure with the given arguments.

### `dereg(String procedureName) ==> Number`

Deregisters a procedure.

### `deregAll() ==> Number`

Removes **all** registered procedures.

### `emit(String eventName, [Any ...data]) ==> Promise`

Publishes the event and passes all data arguments directly to the subscribers.

### `[lifecycleName](String eventName, Function subscriber)`

Register a subscribing function to that part of the event lifecycle.

### `ns(String namespace) ==> HotPress`

Creates an object containing the entire API of which all messages/event names
will be prefixed with a namespace.

### `off(String eventName, [Function subscriber]) ==> Number`

Removes a given subscriber from an event. If none is specified, it will remove
all subscribers from the event.

### `on(String eventName, Function subscriber)`

Register a subscribing function to the event

### `once(String eventName, Function subscriber)`

Registers a subscriber for just one event before it's removed.

### `once[LifecycleName](String eventName, Function subscriber)`

Registers a subscriber, to that part of the event lifecycle, for just one event
before it is removed.

### `triggers(String eventName, Array eventNames)`

When the event has been published, publish an array of of other events.

### `triggers[lifecycleName](String eventName, Function subscriber)`

When the event's lifecycle part has been published, publish an array of other
events.

### `reg(String procedureName, Function procedure)`

Registers a procedure.
