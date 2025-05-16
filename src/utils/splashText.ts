const MAX_WORDS = 5
const HTTPS_REGEX = /^https?:\/\/[-\w@:%.+~#=]{1,256}\.[a-zA-Z\d()]{1,6}\b([-\w()@:%+.~#?&/=]*)$/
const TIMEOUT_MS = 5000

const sanitizeText = (text: string): string => {
  return text.replaceAll(/<[^>]*>/g, '').replaceAll(/[^\w\s.,!?-]/g, '')
}

const limitWords = (text: string): string => {
  const words = text.split(/\s+/)
  if (words.length <= MAX_WORDS) {
    return sanitizeText(text)
  }
  return sanitizeText(words.slice(0, MAX_WORDS).join(' ') + '...')
}

export const isRemoteSplashText = (text: string): boolean => {
  return HTTPS_REGEX.test(text)
}

export const loadRemoteSplashText = async (url: string): Promise<string> => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) {
      throw new Error(`Failed to fetch splash text: ${response.statusText}`)
    }

    const clonedResponse = response.clone()
    try {
      const json = await response.json()

      if (typeof json === 'object' && json !== null) {
        if (json.title) return limitWords(json.title)
        if (json.text) return limitWords(json.text)
        if (json.message) return limitWords(json.message)

        return limitWords(JSON.stringify(json))
      }

      return limitWords(String(json))
    } catch (jsonError) {
      const text = await clonedResponse.text()
      return limitWords(text.trim())
    }
  } catch (error) {
    console.error('Error loading remote splash text:', error)
    return 'Failed to load splash text!'
  }
}
