import { EventListeners } from './EventListeners'

export interface EventLifecycle<Events extends object> {
  before: EventListeners<Events>
  on: EventListeners<Events>
  after: EventListeners<Events>
}

export type EventPart<Events extends object> = keyof EventLifecycle<Events>

export interface EmitOptions {
  timeout?: number
}
