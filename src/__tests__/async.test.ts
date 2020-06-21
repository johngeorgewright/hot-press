import {
  timeout,
  errorAfter,
  TimedOutPromise,
  expectResponseWithin,
} from '../async'

test('timeout()', (done) => {
  const time = setTimeout(
    () => done(new Error("it didn't resolve or took longer than expected")),
    15
  )

  const [promise] = timeout(10)

  promise.then(() => {
    clearTimeout(time)
    done()
  })
})

test('errorAfter()', (done) => {
  const time = setTimeout(
    () => done(new Error("it didn't reject or took longer than expected")),
    15
  )

  const [promise] = errorAfter(10)

  promise.catch((error) => {
    clearTimeout(time)
    expect(error).toBeInstanceOf(TimedOutPromise)
    done()
  })
})

test('cancelling timeouts', (done) => {
  const [promise, cancel] = timeout(15)

  promise.then(() => {
    done(new Error("Cancelling didn't work"))
  })

  setTimeout(cancel, 10)
  setTimeout(done, 20)
})

test('expectResponseWithin()', async () =>
  expectResponseWithin(10, async () => {
    await timeout(5)[0]
  }))
