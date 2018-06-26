/**
 * String representing wildcards
 * @private
 * @type {String}
 */
export const WILDCARD = '*'

/**
 * What separates namespace hierarchy
 * @private
 * @type {String}
 */
export const HIERARCHY_SEPARATOR = '.'

/**
 * Returns a list of messages that should be called in order for a specific
 * message.
 * @private
 * @example
 * getHierarchy('a.b.c.d')
 * // ==> ['a.b.c.d', 'a.b.c.*', 'a.b.*', 'a.*', '*']
 * @param {String} message - The event name/message
 * @return {String[]} The ordered list of messages that should be called
 */
export const getHierarchy = message => {
  const parts = message.split(HIERARCHY_SEPARATOR)
  const hierarchy = [WILDCARD]
  parts.reduce((message, part) => {
    const prefix = message + HIERARCHY_SEPARATOR
    hierarchy.unshift(prefix + WILDCARD)
    return prefix + part
  })
  hierarchy.unshift(message)
  return hierarchy
}

/**
 * Prepends an event name, if the string exists.
 * @private
 * @param {String} name - The event name/message
 * @param {String} prefix - The prefix to prepend
 * @return {String} The transformed string
 */
export const prependHierarchy = (name, prefix) =>
  prefix ? `${prefix}.${name}` : name

/**
 * Removes a given namespace prefixed on a string.
 * @private
 * @param  {String} name   The event name/message
 * @param  {String} prefix The prefix to remove
 * @return {String}        The transformed string
 */
export const removePrefix = (name, prefix) =>
  prefix
    ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length)
    : name
