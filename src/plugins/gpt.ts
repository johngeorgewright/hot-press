import Broker from '..'

interface GPTPluginRequiredEvents {}

export interface GPTPluginEvents {
  start: void
  end: [void, void]
}

export default function gptPlugin(b: Broker<GPTPluginRequiredEvents>) {
  const broker = b.addEventTypes<GPTPluginEvents>()

  broker.on('start', async () => {
    console.info('started')
  })

  return broker
}
