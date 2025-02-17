import * as THREE from 'three'

const textureCache = {}

export function loadTexture (texture: string, cb: (texture: THREE.Texture) => void) {
  const cached = textureCache[texture]
  if (cached) {
    cb(cached)
    return
  }

  const threeTexture = new THREE.TextureLoader().load(texture, (loadedTexture) => {
    loadedTexture.needsUpdate = true
    textureCache[texture] = loadedTexture
    cb(loadedTexture)
  })
}

export function loadJSON (url, callback) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'json'
  xhr.onload = function () {
    const { status } = xhr
    if (status === 200) {
      callback(xhr.response)
    } else {
      throw new Error(url + ' not found')
    }
  }
  xhr.send()
}

export const loadScript = async function (scriptSrc) {
  if (document.querySelector(`script[src="${scriptSrc}"]`)) {
    return
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
