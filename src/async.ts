export type CancelablePromise = [Promise<void>, () => void]

export async function expectResponseWithin<T>(
  ms: number,
  fn: () => Promise<T>
) {
  const promise = fn().then((it) => {
    cancel()
    return it
  })

  const [timer, cancel] = cancellableErrorAfter(ms)

  await Promise.race([timer, promise])

  return promise
}

export function cancellableTimeout(ms: number): CancelablePromise {
  let timeout: number

  const promise = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, ms)
  })

  return [promise, () => clearTimeout(timeout)]
}

export async function timeout(ms: number) {
  const [promise] = cancellableTimeout(ms)
  return promise
}

export function cancellableErrorAfter(ms: number): CancelablePromise {
  let timeout: NodeJS.Timeout

  const promise = new Promise<void>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new TimedOutPromise(promise, ms))
    }, ms)
  })

  return [promise, () => clearTimeout(timeout)]
}

export async function errorAfter(ms: number) {
  const [promise] = cancellableErrorAfter(ms)
  return promise
}

export class TimedOutPromise<T> extends Error {
  public readonly promise: Promise<T>

  constructor(promise: Promise<T>, ms: number) {
    super(`Promise timed out in ${ms}ms`)
    this.promise = promise
  }
}
