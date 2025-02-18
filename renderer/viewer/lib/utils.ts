import * as THREE from 'three'

const textureCache: Record<string, THREE.Texture> = {}
const loadingTextures = new Map<string, Promise<THREE.Texture>>()

export function loadTexture (texture: string, cb: (texture: THREE.Texture) => void): void {
  const cached = textureCache[texture]
  if (cached) {
    cb(cached)
    return
  }

  // Check if this texture is already being loaded
  const loadingPromise = loadingTextures.get(texture)
  if (loadingPromise) {
    void loadingPromise.then(loadedTexture => cb(loadedTexture))
    return
  }

  // Create new loading promise for this texture
  const promise = new Promise<THREE.Texture>(resolve => {
    new THREE.TextureLoader().load(texture, (loadedTexture) => {
      loadedTexture.needsUpdate = true
      textureCache[texture] = loadedTexture
      loadingTextures.delete(texture)
      resolve(loadedTexture)
      cb(loadedTexture)
    })
  })

  loadingTextures.set(texture, promise)
}

export const loadScript = async function (scriptSrc: string): Promise<HTMLScriptElement> {
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`)
  if (existingScript) {
    return existingScript
  }

  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement('script')
    scriptElement.src = scriptSrc
    scriptElement.async = true

    scriptElement.addEventListener('load', () => {
      resolve(scriptElement)
    })

    scriptElement.onerror = (error) => {
      reject(new Error(typeof error === 'string' ? error : (error as any).message))
      scriptElement.remove()
    }

    document.head.appendChild(scriptElement)
  })
}
