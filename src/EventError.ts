import { ListenerArg } from './types/EventListeners'

export default class EventError<
  Events extends object,
  EventName extends keyof Events
> extends Error {
  public readonly originalError: Error
  public readonly eventName: EventName
  public readonly arg: ListenerArg<Events, EventName>

  constructor(
    eventName: EventName,
    arg: ListenerArg<Events, EventName>,
    originalError: Error
  ) {
    super(originalError.message)
    this.eventName = eventName
    this.arg = arg
    this.originalError = originalError
  }
}
