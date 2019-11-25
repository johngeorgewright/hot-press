import HotPressTimeoutError from './hot-press-timeout-error'

export const flatten = (arr: any[][]): any[] => arr.reduce((a, b) => a.concat(b), [])

export const upperFirst = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

export const errorAfterMS = (timeout: number): Promise<void> =>
  new Promise((_resolve, reject) => setTimeout(
    () => reject(new HotPressTimeoutError(timeout)),
    timeout
  ))

export const findDuplicates = (arr: any[]): any[] => {
  const dupCounts = arr.reduce(
    (dupCounts, item) => Object.assign(dupCounts, {
      [item]: (dupCounts[item] || 0) + 1
    }),
    {}
  )
  return Object.keys(dupCounts).filter(it => dupCounts[it] > 1)
}
