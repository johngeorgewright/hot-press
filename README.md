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

```javascript
import {emit, on} from 'hot-press';

on('event', (...data) => console.log(...data));
emit('event', 'some', 'variables'); // 'some' 'variables'
```

### Unsubscribe

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
