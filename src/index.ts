type Listener<Arg> = (arg: Arg) => Promise<void>

type EventListeners<Events extends object> = {
  [EventName in keyof Events]?: Array<Listener<Events[EventName]>>
}

interface EventLifecycle<Events extends object> {
  before: EventListeners<Events>
  on: EventListeners<Events>
  after: EventListeners<Events>
}

class Broker<Events extends object> {
  private listeners: EventLifecycle<Events>

  constructor() {
    this.listeners = {
      before: {},
      on: {},
      after: {},
    } as EventLifecycle<Events>
  }

  private async emitPart<EventName extends keyof Events>(
    part: keyof EventLifecycle<Events>,
    eventName: EventName,
    arg: Events[EventName]
  ) {
    const listeners = this.listeners[part][eventName]

    return listeners
      ? Promise.all(
          listeners.map((listener) => listener(arg as Events[EventName]))
        )
      : []
  }

  async emit<EventName extends keyof Events>(
    ...[eventName, arg]: Events[EventName] extends void
      ? [EventName]
      : [EventName, Events[EventName]]
  ) {
    await this.emitPart('before', eventName, arg as Events[EventName])
    await this.emitPart('on', eventName, arg as Events[EventName])
    await this.emitPart('after', eventName, arg as Events[EventName])
  }

  private addEventListener<EventName extends keyof Events>(
    part: keyof EventLifecycle<Events>,
    eventName: EventName,
    listener: (arg: Events[EventName]) => Promise<void>
  ) {
    if (!this.listeners[part][eventName]) {
      this.listeners[part][eventName] = []
    }

    this.listeners[part][eventName]!.push(listener)
    return this
  }

  before<EventName extends keyof Events>(
    eventName: EventName,
    listener: (arg: Events[EventName]) => Promise<void>
  ) {
    return this.addEventListener('before', eventName, listener)
  }

  on<EventName extends keyof Events>(
    eventName: EventName,
    listener: (arg: Events[EventName]) => Promise<void>
  ) {
    return this.addEventListener('on', eventName, listener)
  }

  after<EventName extends keyof Events>(
    eventName: EventName,
    listener: (arg: Events[EventName]) => Promise<void>
  ) {
    return this.addEventListener('after', eventName, listener)
  }

  extend<NewEvents extends object>(): Broker<Events & NewEvents> {
    return this as Broker<Events & NewEvents>
  }
}
