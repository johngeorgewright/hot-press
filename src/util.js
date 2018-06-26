import HotPressTimeoutError from './hot-press-timeout-error'

/**
 * Flattens an 2 dimensional array.
 * @private
 * @param {Any[]} arr - The array to flatten
 * @return {Any[]} The flattened array
 */
export const flatten = arr => arr.reduce((a, b) => a.concat(b), [])

/**
 * Transforms the 1st character of a string to uppercase.
 * @private
 * @param {String} str - The string to manipulate.
 * @return {String} The transformed string.
 */
export const upperFirst = str => str.charAt(0).toUpperCase() + str.slice(1)

/**
 * Create a promise and reject it in a given amount of milliseconds.
 * @private
 * @param {Number} timeout Timeout in milliseconds
 * @return {Promise} A promise that will be rejected within the given time
 */
export const errorAfterMS = timeout =>
  new Promise((resolve, reject) => setTimeout(
    () => reject(new HotPressTimeoutError(timeout)),
    timeout
  ))

/**
 * Finds and returns duplicates in an array.
 * @private
 * @param {Any[]} arr The array to search
 * @return {Any[]} An array of duplicates
 */
export const findDuplicates = arr => {
  const dupCounts = arr.reduce(
    (dupCounts, item) => Object.assign(dupCounts, {
      [item]: (dupCounts[item] || 0) + 1
    }),
    {}
  )
  return Object.keys(dupCounts).filter(it => dupCounts[it] > 1)
}
