# hot-press

[![Coverage Status](https://coveralls.io/repos/github/johngeorgewright/hot-press/badge.svg?branch=master)](https://coveralls.io/github/johngeorgewright/hot-press?branch=master)
[![Build Status](https://travis-ci.org/johngeorgewright/hot-press.svg?branch=master)](https://travis-ci.org/johngeorgewright/hot-press)

> PubSub library with extra asynchronous handling

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
import {emit, on} from 'hot-press';

on('event', (eventName, ...data) => console.log(...data));
emit('event', 'some', 'variables');
// 'some' 'variables'
```

### Subscribing to multiple events

Using the `all` function you can trigger a subscriber only once all the events
have been emitted.

```javascript
import {emit, all} from 'hot-press';

all({on: ['event1', 'event2']}, () => console.log('Triggered!'));
emit('event1');
emit('event2');
// 'Triggered!'
```

### Subscription hierarchy

Dots symbolize subscription hierarchy.

```javascript
import {emit, on} from 'hot-press';

on('foo.bar', message => console.log(message));
on('foo', message => console.log(message));
emit('foo.bar');
// 'foo.bar'
// 'foo.bar'
```

### Subscribing with wildcards

Using the `*` operator, you can subscribe to all events.

```javascript
import {emit, on} from 'hot-press';

on('*', () => console.log(2));
on('e.*', () => console.log(1));
emit('e.f');
// 1
// 2
```

### Unsubscribe

Remove all or specific subscribers from events using the `off()` function.

```javascript
import {emit, off, on} from 'hot-press';

let fn = () => console.log('blah');

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
import {after, before, emit, off, on} from 'hot-press';

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
import {after, before, emit, on} from 'hot-press';

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
    let log = () => {
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
import HP, {ns} from 'hot-press';

HP.timeout = 1000; // global
ns('myNamespace').timeout = 600; // specific to a namespace
```

If the timeout is exceeded by a listener within any part of event lifecycle, the
listener is terminated and an error event is published; it will not kill the
event.

### Namespacing

You can create a version of hot-press prefixing all messages with a namepsace.

```javascript
import {ns} from 'hot-press';
const {emit, on} = ns('foo');

on('event', eventName => console.log(eventName));
emit('event');
// foo.event
```

### Error handling

Errors thrown within listeners/subscribers are swallowed but can be captured in
error events:

```javascript
import {emit, on} from 'hot-press';

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
import {reg, call, on} from 'hot-press';

reg('users.get', query => User.all(query));

on('error.users.get', error => console.error(error));

on('users.get', query => console.log('Querying users table', query));

call('users.get', {type: 'admin'}).then(users => {
  // Do something with users
});
```

## API

### `after(String eventName, Function subscriber)`

Register a subscribing function to the end of the event.

### `all(Object<before: String[], on: String[], after: String[]> eventNames, Function subscriber)`

Register a subscriber for when all events have been published

### `before(String eventName, Function subscriber)`

Register a subscribing function to the beginning of the event.

### `dereg(String procedureName) ==> Number`

Deregisters a procedure.

### `emit(String eventName, [Any ...data]) ==> Promise`

Publishes the event and passes all data arguments directly to the subscribers.

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

### `onceAfter(String eventName, Function subscriber)`

Registers a subscriber, to the end of the event lifecycle, for just one event
before it is removed.

### `onceBefore(String eventName, Function subscriber)`

Registers a subscriber, to the beginning of the event lifecycle, for just one
event before it is removed.

### `triggers(String eventName, Array eventNames)`

When the event has been published, publish an array of of other events.

### `reg(String procedureName, Function procedure)`

Registers a procedure.

### `call(String procedureName, [...Any]) ==> Promise`

Call a procedure with the given arguments.
