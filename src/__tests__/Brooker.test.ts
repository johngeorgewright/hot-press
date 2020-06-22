import Broker from '../Broker'

test('asynchronous lifecycle', async () => {
  const broker = new Broker<{
    timer: [void, number]
  }>()

  const mock = jest.fn()

  broker.before('timer', async () => {
    await randomTimeout()
    mock(1)
    return 1
  })

  broker.on('timer', async () => {
    await randomTimeout()
    mock(2)
    return 2
  })

  broker.after('timer', async () => {
    await randomTimeout()
    mock(3)
    return 3
  })

  broker.before('timer', async () => {
    await randomTimeout()
    mock(1)
    return 1
  })

  broker.on('timer', async () => {
    await randomTimeout()
    mock(2)
    return 2
  })

  expect(await broker.emit('timer')).toEqual([1, 1, 2, 2, 3])
  expect(mock).toHaveBeenNthCalledWith(1, 1)
  expect(mock).toHaveBeenNthCalledWith(2, 1)
  expect(mock).toHaveBeenNthCalledWith(3, 2)
  expect(mock).toHaveBeenNthCalledWith(4, 2)
  expect(mock).toHaveBeenNthCalledWith(5, 3)
})

test('once listeners', async () => {
  const broker = new Broker<{ foo: ['bar', void] }>()
  const mock = jest.fn()

  broker.once('foo', mock)
  await Promise.all([broker.emit('foo', 'bar'), broker.emit('foo', 'bar')])
  expect(mock).toHaveBeenCalledTimes(1)
})

async function randomTimeout() {
  return new Promise((resolve) => {
    setTimeout(resolve, randomNumber())
  })
}

function randomNumber() {
  return Math.random() * 100
}
