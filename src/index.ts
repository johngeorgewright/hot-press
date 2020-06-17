class Broker<Events extends object> {
  private listeners: {
    [EventName in keyof Events]: Array<
      (arg: Events[EventName]) => Promise<void>
    >
  }

  constructor() {
    this.listeners = {} as {
      [EventName in keyof Events]: Array<
        (arg: Events[EventName]) => Promise<void>
      >
    }
  }

  async emit<EventName extends keyof Events>(
    ...[eventName, arg]: Events[EventName] extends void
      ? [EventName]
      : [EventName, Events[EventName]]
  ): Promise<void> {
    await Promise.all(
      this.listeners[eventName].map((listener) =>
        listener(arg as Events[EventName])
      )
    )
  }

  on<EventName extends keyof Events>(
    eventName: EventName,
    listener: (arg: Events[EventName]) => Promise<void>
  ) {
    const events = this.listeners[eventName] || {}
    events.push(listener)
    return this
  }

  extend<NewEvents extends object>(): Broker<Events & NewEvents> {
    return this as Broker<Events & NewEvents>
  }
}
