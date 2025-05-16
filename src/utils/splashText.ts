const MAX_WORDS = 5
const HTTPS_REGEX = /^https?:\/\/[-\w@:%.+~#=]{1,256}\.[a-zA-Z\d()]{1,6}\b([-\w()@:%+.~#?&/=]*)$/

const limitWords = (text: string): string => {
  const words = text.split(/\s+/)
  if (words.length <= MAX_WORDS) {
    return text
  }
  return words.slice(0, MAX_WORDS).join(' ') + '...'
}

export const isRemoteSplashText = (text: string): boolean => {
  return HTTPS_REGEX.test(text)
}

export const loadRemoteSplashText = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url)
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
