export const WILDCARD = '*'

export const HIERARCHY_SEPARATOR = '.'

export const getHierarchy = (message: string): string[] => {
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

export const prependHierarchy = (name: string, prefix: string): string =>
  prefix ? `${prefix}.${name}` : name

export const removePrefix = (name: string, prefix: string): string =>
  prefix
    ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length)
    : name
   