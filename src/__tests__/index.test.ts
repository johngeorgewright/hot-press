import Broker from '..'

test('asynchronous lifecycle', async () => {
  const broker = new Broker<{
    timer: void
  }>()

  const mock = jest.fn()

  broker.before('timer', async () => {
    await randomTimeout()
    mock(1)
  })

  broker.on('timer', async () => {
    await randomTimeout()
    mock(3)
  })

  broker.after('timer', async () => {
    await randomTimeout()
    mock(5)
  })

  broker.before('timer', async () => {
    await randomTimeout()
    mock(2)
  })

  broker.on('timer', async () => {
    await randomTimeout()
    mock(4)
  })

  await broker.emit('timer')

  expect(mock).toHaveBeenNthCalledWith(1, 1)
  expect(mock).toHaveBeenNthCalledWith(2, 2)
  expect(mock).toHaveBeenNthCalledWith(3, 3)
  expect(mock).toHaveBeenNthCalledWith(4, 4)
  expect(mock).toHaveBeenNthCalledWith(5, 5)
})

async function randomTimeout() {
  return new Promise((resolve) => {
    setTimeout(resolve, randomNumber())
  })
}

function randomNumber() {
  return Math.random() * 100
}
