import EventError from '../EventError'

export type ListenerArg<
  Events extends object,
  EventName extends keyof Events
> = Events[EventName] extends [any, any]
  ? Events[EventName][0]
  : Events[EventName]

export type ListenerReturn<
  Events extends object,
  EventName extends keyof Events
> = Events[EventName] extends [any, any] ? Events[EventName][1] : void

export type Listener<Events extends object, EventName extends keyof Events> = (
  arg: ListenerArg<Events, EventName>
) => Promise<ListenerReturn<Events, EventName>>

export type ErrorListener<
  Events extends object,
  EventName extends keyof Events
> = (error: EventError<Events, EventName>) => void

export type EventListeners<Events extends object> = {
  [EventName in keyof Events]?: Listener<Events, EventName>[]
}

export type ErrorListeners<Events extends object> = {
  [EventName in keyof Events]?: ErrorListener<Events, EventName>[]
}
