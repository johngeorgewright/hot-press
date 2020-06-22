import { resolveWithin } from './async'
import EventError from './EventError'
import {
  ErrorListener,
  ErrorListeners,
  Listener,
  ListenerArg,
  ListenerReturn,
} from './types/EventListeners'
import { EventLifecycle, EventPart } from './types/EventLifecycle'

export interface EmitOptions {
  timeout?: number
}

export type ListenerOptions = WeakMap<Listener<any, any>, EmitOptions>

export default class Broker<Events extends object> {
  private errorListeners: ErrorListeners<Events>
  private listeners: EventLifecycle<Events>
  private listenerOptions: ListenerOptions
  private timeout: number

  constructor({ timeout = 500 }: EmitOptions = {}) {
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
    { timeout = this.timeout }: EmitOptions = {}
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
    options?: EmitOptions
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
    options?: EmitOptions
  ) {
    return this.addEventListener('before', eventName, listener, options)
  }

  onceBefore<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmitOptions
  ) {
    return this.addOnceListener('before', eventName, listener, options)
  }

  on<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmitOptions
  ) {
    return this.addEventListener('on', eventName, listener, options)
  }

  once<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmitOptions
  ) {
    return this.addOnceListener('on', eventName, listener, options)
  }

  after<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmitOptions
  ) {
    return this.addEventListener('after', eventName, listener, options)
  }

  onceAfter<EventName extends keyof Events>(
    eventName: EventName,
    listener: Listener<Events, EventName>,
    options?: EmitOptions
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
