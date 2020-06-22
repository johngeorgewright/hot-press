import Broker from '..'
import { GPTPluginEvents } from './gpt'

type ReadyPluginRequiredEvents = GPTPluginEvents

export interface ReadyPluginEvents {
  ready: [void, void]
}

export default function readyPlugin(b: Broker<ReadyPluginRequiredEvents>) {
  const broker = b.addEventTypes<ReadyPluginEvents>()
  return broker
}
