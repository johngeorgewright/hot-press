export type CancelablePromise = [Promise<void>, () => void]

export async function resolveWithin<T>(ms: number, promise: Promise<T>) {
  const promise2 = promise.then((it) => {
    cancel()
    return it
  })

  const [timer, cancel] = cancelableErrorAfter(ms)
  await Promise.race([timer, promise2])
  return promise2
}

export function cancelableTimeout(ms: number): CancelablePromise {
  let timeout: number

  const promise = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, ms)
  })

  return [promise, () => clearTimeout(timeout)]
}

export async function timeout(ms: number) {
  const [promise] = cancelableTimeout(ms)
  return promise
}

export function cancelableErrorAfter(ms: number): CancelablePromise {
  let timeout: NodeJS.Timeout

  const promise = new Promise<void>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new PromiseTimedOutError(promise, ms))
    }, ms)
  })

  return [promise, () => clearTimeout(timeout)]
}

export async function errorAfter(ms: number) {
  const [promise] = cancelableErrorAfter(ms)
  return promise
}

export class PromiseTimedOutError<T> extends Error {
  public readonly promise: Promise<T>

  constructor(promise: Promise<T>, ms: number) {
    super(`Promise timed out after ${ms}ms`)
    this.promise = promise
  }
}
