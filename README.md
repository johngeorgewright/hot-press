# hot-press

> PubSub library with extra asynchronous handling

## Installation

This is built in ECMAScript 6 with no precompiling. If you require this in
earlier versions of ECMAScript, please use a compiler. This will work with
Node v6 without any flags and Node v4 with the `--harmony` flag.

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

on('event', (...data) => console.log(...data));
emit('event', 'some', 'variables'); // 'some' 'variables'
```

### Unsubscribe

Remove all or specific subscribers from events using the `off()` function.

```javascript
import {emit, off, on} from 'hot-press';

let fn = () => console.log('blah');

on('event', fn);
on('event', fn);
on('event', fn);

emit('event'); // blah blah blah

off('event', fn);
emit('event'); // blah blah

off('event');
emit('event'); // <nothing>
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
emit('event'); // 1 2 3
off('event');

after('event', () => console.log(3));
before('event', () => console.log(1));
on('event', () => console.log(2));
emit('event'); // 1 2 3
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
import {before, emit, on} from 'hot-press';

before('event', eventuallyLog(1));
on('event', eventuallyLog(2));
after('event', eventuallyLog(3));
emit('event').then(() => console.log(4));
// 1 2 3 4

function eventuallyLog(num) {
  return () => new Promise(resolve => {
    setTimeout(() => {
      console.log(num);
      resolve();
    }, 100);
  });
}
```

## API

### `after(String eventName, Function subscriber)`

Register a subscribing function to the end of the event.

### `all(Array eventNames, Function subscriber)`

Register a subscriber for when all events have been published

### `before(String eventName, Function subscriber)`

Register a subscribing function to the beginning of the event.

### `emit(String eventName, [Any ...data])`

Publishes the event and passes all data arguments directly to the subscribers.

### `off(String eventName, [Function subscriber])`

Removes a given subscriber from an event. If none is specified, it will remove all
subscribers from the event.

### `on(String eventName, Function subscriber)`

Register a subcribing function to the event

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
