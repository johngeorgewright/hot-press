import { resolveWithin } from './async'

type ListenerArg<
  Events extends object,
  EventName extends keyof Events
> = Events[EventName] extends [any, any]
  ? Events[EventName][0]
  : Events[EventName]

type ListenerReturn<
  Events extends object,
  EventName extends keyof Events
> = Events[EventName] extends [any, any] ? Events[EventName][1] : void

interface Listener<Events extends object, EventName extends keyof Events> {
  (arg: ListenerArg<Events, EventName>): Promise<
    ListenerReturn<Events, EventName>
  >
}

interface ErrorListener<Events extends object, EventName extends keyof Events> {
  (error: EventError<Events, EventName>): void
}

type EventListeners<Events extends object> = {
  [EventName in keyof Events]?: Listener<Events, EventName>[]
}

type ErrorListeners<Events extends object> = {
  [EventName in keyof Events]?: ErrorListener<Events, EventName>[]
}

type ListenerOptions = WeakMap<Listener<any, any>, EmittionOptions>

interface EventLifecycle<Events extends object> {
  before: EventListeners<Events>
  on: EventListeners<Events>
  after: EventListeners<Events>
}

type EventPart<Events extends object> = keyof EventLifecycle<Events>

interface EmittionOptions {
  timeout?: number
}

export default class Broker<Events extends object> {
  private errorListeners: ErrorListeners<Events>
  private listeners: EventLifecycle<Events>
  private listenerOptions: ListenerOptions
  private timeout: number

  constructor({ timeout = 500 }: EmittionOptions = {}) {
    this.errorListeners = {}
    this.listeners = {
      before: {},
      on: {},
      after: {},
    }
    this.listenerOptions = new WeakMap()
    this.timeout = timeout
  }

  private async callListener<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    arg: ListenerArg<Events, EventName>
  ): Promise<
    ListenerReturn<Events, EventName> | EventError<Events, EventName>
  > {
    const { timeout = this.timeout } = this.listenerOptions.get(listener) || {}

    try {
      return await resolveWithin(timeout, listener(arg))
    } catch (error) {
      return this.emitError(eventName, arg, error)
    }
  }

  private async emitError<EventName extends keyof Events>(
    eventName: EventName,
    arg: ListenerArg<Events, EventName>,
    error: Error
  ) {
    const listeners = this.errorListeners[eventName]
    const eventError = new EventError(eventName, arg, error)

    if (!listeners) {
      return eventError
    }

    for (const listener of listeners!) {
      listener(eventError)
    }

    return eventError
  }

  private async emitPart<EventName extends keyof Events>(
    part: EventPart<Events>,
    eventName: EventName,
    arg: ListenerArg<Events, EventName>
  ) {
    const listeners = this.listeners[part][eventName]

    return listeners
      ? Promise.all(
          listeners.map((listener) =>
            this.callListener(eventName, listener, arg)
          )
        )
      : ([] as ListenerReturn<Events, EventName>[])
  }

  async emit<EventName extends keyof Events>(
    ...[eventName, arg]: ListenerArg<Events, EventName> extends void
      ? [EventName]
      : [EventName, ListenerArg<Events, EventName>]
  ) {
    return [
      ...(await this.emitPart(
        'before',
        eventName,
        arg as ListenerArg<Events, EventName>
      )),
      ...(await this.emitPart(
        'on',
        eventName,
        arg as ListenerArg<Events, EventName>
      )),
      ...(await this.emitPart(
        'after',
        eventName,
        arg as ListenerArg<Events, EventName>
      )),
    ]
  }

  private addEventListener<EventName extends keyof Events>(
    part: EventPart<Events>,
    eventName: EventName,
    listener: Listener<Events, EventName>,
    { timeout = this.timeout }: EmittionOptions = {}
  ) {
    if (!this.listeners[part][eventName]) {
      this.listeners[part][eventName] = []
    }

    this.listeners[part][eventName]!.push(listener)
    this.listenerOptions.set(listener, { timeout })

    return this
  }

  private addOnceListener<EventName extends keyof Events>(
    part: EventPart<Events>,
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    const listenerWrapper: Listener<Events, EventName> = async (arg) => {
      this.removeFrom(part, eventName, listenerWrapper)
      return listener(arg)
    }

    return this.addEventListener(part, eventName, listenerWrapper, options)
  }

  before<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addEventListener('before', eventName, listener, options)
  }

  onceBefore<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addOnceListener('before', eventName, listener, options)
  }

  on<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addEventListener('on', eventName, listener, options)
  }

  once<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addOnceListener('on', eventName, listener, options)
  }

  after<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addEventListener('after', eventName, listener, options)
  }

  onceAfter<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmittionOptions
  ) {
    return this.addOnceListener('after', eventName, listener, options)
  }

  onError<EventName extends keyof Events>(
    eventName: EventName,
    listener: ErrorListener<Events, EventName>
  ) {
    if (!this.errorListeners[eventName]) {
      this.errorListeners[eventName] = []
    }

    this.errorListeners[eventName]!.push(listener)
    return this
  }

  private removeFrom<EventName extends keyof Events>(
    part: EventPart<Events>,
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    this.listenerOptions.delete(listener)
    this.listeners[part][eventName] = (this.listeners[part][eventName] ||
      [])!.filter((l) => l !== listener)
    return this
  }

  remove<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    return this.removeFrom('on', eventName, listener)
  }

  removeBefore<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    return this.removeFrom('before', eventName, listener)
  }

  removeAfter<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>
  ) {
    return this.removeFrom('after', eventName, listener)
  }

  /**
   * A way to attach more event definitions to a broker.
   *
   * @example
   * const broker = new Broker<{ foo: ['arg', 'return'] }>()
   * const broker2 = broker.addEventTypes<{ mung: ['face', 'return'] }>()
   *
   * broker2.emit('mung', 'arg')
   * broker2.emit('foo', 'arg')
   */
  addEventTypes<NewEvents extends object>(): Broker<Events & NewEvents> {
    return (this as unknown) as Broker<Events & NewEvents>
  }
}

export class EventError<
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
