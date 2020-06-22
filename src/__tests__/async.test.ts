import { cancelableTimeout, timeout, resolveWithin, errorAfter } from '../async'

test('timeout()', (done) => {
  const time = setTimeout(
    () => done(new Error("it didn't resolve or took longer than expected")),
    15
  )

  const promise = timeout(10)

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

  const promise = errorAfter(10)

  promise.catch((error) => {
    clearTimeout(time)
    expect(error.message).toBe('Promise timed out after 10ms')
    expect(error).toHaveProperty('promise')
    done()
  })
})

test('cancelableTimeout()', (done) => {
  const [promise, cancel] = cancelableTimeout(15)

  promise.then(() => {
    done(new Error("Cancelling didn't work"))
  })

  setTimeout(cancel, 10)
  setTimeout(done, 20)
})

test('resolveWithin()', async () => resolveWithin(10, timeout(5)))
