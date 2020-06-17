export const WILDCARD = '*'

export const HIERARCHY_SEPARATOR = '.'

export function getHierarchy(message: string) {
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

export function prependHierarchy(name: string, prefix: string) {
  return prefix ? `${prefix}.${name}` : name
}

export function removePrefix(name: string, prefix: string) {
  return prefix ? name.substr(prefix.length + HIERARCHY_SEPARATOR.length) : name
}
