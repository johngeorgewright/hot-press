import Broker from '.'
import * as plugins from './plugins'
import { pipe } from 'ramda'

const broker = pipe(() => new Broker(), plugins.gpt, plugins.ready)
