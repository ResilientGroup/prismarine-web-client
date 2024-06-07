import Jimp from 'jimp'
import minecraftData from 'minecraft-data'
import { McAssets } from './modelsBuilder'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { versionToNumber } from './utils'

// todo refactor
const handledBlocks = ['water', 'lava', 'barrier']
const origSizeTextures: string[] = []
let currentImage: Jimp
let currentBlockName: string
let currentMcAssets: McAssets
const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))

type SidesType = {
  "up": string
  "north": string
  "east": string
  "south": string
  "west": string
  "down": string
}

const getBlockStates = (name: string) => {
  const mcData = minecraftData(currentMcAssets.version)
  return mcData.blocksByName[name]?.states
}

export const addBlockCustomSidesModel = (name: string, sides: SidesType) => {
  currentMcAssets.blocksStates[name] = {
    "variants": {
      "": {
        "model": name
      }
    }
  }
  currentMcAssets.blocksModels[name] = {
    "parent": "block/cube",
    "textures": sides
  }
}

type TextureMap = [
  x: number,
  y: number,
  width?: number,
  height?: number,
]

const justCropUV = (x: number, y: number, x1, y1) => {
  // input: 0-16, output: 0-currentImage.getWidth()
  const width = Math.abs(x1 - x)
  const height = Math.abs(y1 - y)
  return currentImage.clone().crop(
    x / 16 * currentImage.getWidth(),
    y / 16 * currentImage.getHeight(),
    width / 16 * currentImage.getWidth(),
    height / 16 * currentImage.getHeight(),
  )
}
const justCrop = (x: number, y: number, width = 16, height = 16) => {
  return currentImage.clone().crop(x, y, width, height)
}

const combineTextures = (locations: TextureMap[]) => {
  const resized: Jimp[] = []
  for (const [x, y, height = 16, width = 16] of locations) {
    resized.push(justCrop(x, y, width, height))
  }

  const combinedImage = new Jimp(locations[0]![2] ?? 16, locations[0]![3] ?? 16)
  for (const image of resized) {
    combinedImage.blit(image, 0, 0)
  }
  return combinedImage
}

const generatedImageTextures: { [blockName: string]: /* base64 */string } = {}

const getBlockTexturesFromJimp = async <T extends Record<string, Jimp>> (sides: T, withUv = false, textureNameBase = currentBlockName): Promise<Record<keyof T, any>> => {
  const sidesTextures = {} as any
  for (const [side, jimp] of Object.entries(sides)) {
    const textureName = `${textureNameBase}_${side}`
    const sideTexture = withUv ? { uv: [0, 0, jimp.getWidth(), jimp.getHeight()], texture: textureName } : textureName
    const base64Url = await jimp.getBase64Async(jimp.getMIME())
    if (side === 'side') {
      sidesTextures['north'] = sideTexture
      sidesTextures['east'] = sideTexture
      sidesTextures['south'] = sideTexture
      sidesTextures['west'] = sideTexture
    } else {
      sidesTextures[side] = sideTexture
    }
    generatedImageTextures[textureName] = base64Url
  }

  return sidesTextures
}

const addSimpleCubeWithSides = async (sides: Record<string, Jimp>) => {
  const sidesTextures = await getBlockTexturesFromJimp(sides)

  addBlockCustomSidesModel(currentBlockName, sidesTextures as any)
}

const handleShulkerBox = async (dataBase: string, match: RegExpExecArray) => {
  const [, shulkerColor = ''] = match
  currentImage = await Jimp.read(dataBase + `entity/shulker/shulker${shulkerColor && `_${shulkerColor}`}.png`)

  const shulkerBoxTextures = {
    // todo do all sides
    side: combineTextures([
      [0, 16], // top
      [0, 36], // bottom
    ]),
    up: justCrop(16, 0),
    down: justCrop(32, 28)
  }

  await addSimpleCubeWithSides(shulkerBoxTextures)
}

// TODO! should not be there! move to data with signs!
const chestModels = {
  chest: {
    "parent": "block/block",
    "textures": {
      "particle": "#particles"
    },
    "elements": [
      {
        "from": [1, 0, 1],
        "to": [15, 10, 15],
        "faces": {
          "down": { "texture": "#chest", "uv": [3.5, 4.75, 7, 8.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [10.5, 8.25, 14, 10.75], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0, 8.25, 3.5, 10.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 8.25, 7, 10.75], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [7, 8.25, 10.5, 10.75], "rotation": 180 }
        },
      },
      {
        "from": [1, 10, 1],
        "to": [15, 14, 15],
        "faces": {
          "up": { "texture": "#chest", "uv": [3.5, 4.75, 7, 8.25] },
          "north": { "texture": "#chest", "uv": [10.5, 3.75, 14, 4.75], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0, 3.75, 3.5, 4.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 3.75, 7, 4.75], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [7, 3.75, 10.5, 4.75], "rotation": 180 }
        }
      },
      {
        "from": [7, 7, 0],
        "to": [9, 11, 1],
        "faces": {
          "down": { "texture": "#chest", "uv": [0.25, 0, 0.75, 0.25], "rotation": 180 },
          "up": { "texture": "#chest", "uv": [0.75, 0, 1.25, 0.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [1, 0.25, 1.5, 1.25], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [0.75, 0.25, 1, 1.25], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0, 0.25, 0.25, 1.25], "rotation": 180 }
        }
      }
    ]
  },
  chest_left: {
    "parent": "block/block",
    "textures": {
      "particle": "#particles"
    },
    "elements": [
      {
        "from": [1, 0, 1],
        "to": [16, 10, 15],
        "faces": {
          "down": { "texture": "#chest", "uv": [3.5, 4.75, 7.25, 8.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [10.75, 8.25, 14.5, 10.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 8.25, 7.25, 10.75], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [7.25, 8.25, 10.75, 10.75], "rotation": 180 }
        }
      },
      {
        "from": [1, 10, 1],
        "to": [16, 14, 15],
        "faces": {
          "up": { "texture": "#chest", "uv": [3.5, 4.75, 7.25, 8.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [10.75, 3.75, 14.5, 4.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 3.75, 7.25, 4.75], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [7.25, 3.75, 10.75, 4.75], "rotation": 180 }
        }
      },
      {
        "from": [15, 7, 0],
        "to": [16, 11, 1],
        "faces": {
          "down": { "texture": "#chest", "uv": [0.25, 0, 0.5, 0.25], "rotation": 180 },
          "up": { "texture": "#chest", "uv": [0.5, 0, 0.75, 0.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [0.75, 0.25, 1, 1.25], "rotation": 180 },
          "west": { "texture": "#chest", "uv": [0.5, 0.25, 0.75, 1.25], "rotation": 180 }
        }
      }
    ]
  },
  chest_right: {
    "parent": "block/block",
    "textures": {
      "particle": "#particles"
    },
    "elements": [
      {
        "from": [0, 0, 1],
        "to": [15, 10, 15],
        "faces": {
          "down": { "texture": "#chest", "uv": [3.5, 4.75, 7.25, 8.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [10.75, 8.25, 14.5, 10.75], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0, 8.25, 3.5, 10.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 8.25, 7.25, 10.75], "rotation": 180 }
        }
      },
      {
        "from": [0, 10, 1],
        "to": [15, 14, 15],
        "faces": {
          "up": { "texture": "#chest", "uv": [3.5, 4.75, 7.25, 8.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [10.75, 3.75, 14.5, 4.75], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0, 3.75, 3.5, 4.75], "rotation": 180 },
          "south": { "texture": "#chest", "uv": [3.5, 3.75, 7.25, 4.75], "rotation": 180 }
        }
      },
      {
        "from": [0, 7, 0],
        "to": [1, 11, 1],
        "faces": {
          "down": { "texture": "#chest", "uv": [0.25, 0, 0.5, 0.25], "rotation": 180 },
          "up": { "texture": "#chest", "uv": [0.5, 0, 0.75, 0.25], "rotation": 180 },
          "north": { "texture": "#chest", "uv": [0.75, 0.25, 1, 1.25], "rotation": 180 },
          "east": { "texture": "#chest", "uv": [0.0, 0.25, 0.25, 1.25], "rotation": 180 }
        }
      }
    ]
  }
}

// these blockStates / models copied from https://github.com/FakeDomi/FastChest/blob/master/src/main/resources/assets/minecraft/blockstates/
const chestBlockStatesMap = {
  chest: JSON.parse(fs.readFileSync(path.join(__dirname, 'blockStates/chest.json'), 'utf-8')),
  trapped_chest: JSON.parse(fs.readFileSync(path.join(__dirname, 'blockStates/trapped_chest.json'), 'utf-8')),
  ender_chest: JSON.parse(fs.readFileSync(path.join(__dirname, 'blockStates/ender_chest.json'), 'utf-8')),
}
const handleChest = async (dataBase: string, match: RegExpExecArray) => {
  const blockStates = structuredClone(chestBlockStatesMap[currentBlockName])

  const particle = match[1] === 'ender' ? 'obsidian' : 'oak_planks'

  const blockStatesVariants = Object.values(blockStates.variants) as { model }[]
  const neededModels = [...new Set(blockStatesVariants.map((x) => x.model))]

  for (const modelName of neededModels) {
    let chestTextureName = {
      chest: 'normal',
      trapped_chest: 'trapped',
      ender_chest: 'ender',
    }[currentBlockName]
    if (modelName.endsWith('_left')) chestTextureName = `${chestTextureName}_left`
    if (modelName.endsWith('_right')) chestTextureName = `${chestTextureName}_right`

    const texture = path.join(currentMcAssets.directory, `../1.19.1/entity/chest/${chestTextureName}.png`)

    currentImage = await Jimp.read(texture)

    const model = structuredClone(chestModels[modelName])
    model.textures.particle = particle
    const newModelName = `${currentBlockName}_${modelName}`
    for (const variant of blockStatesVariants) {
      if (variant.model !== modelName) continue
      variant.model = newModelName
    }
    for (const [i, { faces }] of model.elements.entries()) {
      for (const [faceName, face] of Object.entries(faces) as any) {
        const { uv } = face
        //@ts-ignore
        const jimp = justCropUV(...uv)
        const key = `${chestTextureName}_${modelName}_${i}_${faceName}`
        const texture = await getBlockTexturesFromJimp({
          [key]: jimp
        }, true, key).then(a => a[key])
        face.texture = texture.texture
        face.uv = texture.uv
      }
    }
    currentMcAssets.blocksModels[newModelName] = model
  }
  currentMcAssets.blocksStates[currentBlockName] = blockStates
}

async function loadBlockModelTextures (dataBase: string, blockModel: any) {
  for (const key in blockModel.textures) {
    let texture: string = blockModel.textures[key]
    const useAssetsPath = !!texture.match(/^[0-9.]+\//)
    blockModel.textures.particle = texture
    generatedImageTextures[texture] = `data:image/png;base64,${fs.readFileSync(path.join(dataBase, useAssetsPath ? '..' : '', texture + '.png'), 'base64')}`
    origSizeTextures[texture] = true
  }
}

const handlers = [
  [/(.+)_shulker_box$/, handleShulkerBox],
  [/^shulker_box$/, handleShulkerBox],
  [/^(?:(ender|trapped)_)?chest$/, handleChest],
  // [/(^|(.+)_)bed$/, handleBed],
  // no-op just suppress warning
  [/(^light|^moving_piston$)/, true],
] as const

export const tryHandleBlockEntity = async (dataBase, blockName) => {
  currentBlockName = blockName
  for (const [regex, handler] of handlers) {
    const match = regex.exec(blockName)
    if (!match) continue
    if (handler !== true) {
      await handler(dataBase, match)
    }
    return true
  }
}

async function readAllBlockStates (blockStatesDir: string) {
  const files = fs.readdirSync(blockStatesDir)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const state = JSON.parse(fs.readFileSync(path.join(blockStatesDir, file), 'utf-8'))
      const name = file.replace('.json', '')
      currentMcAssets.blocksStates[name] = state
      handledBlocks.push(name)
    } else {
      await readAllBlockStates(path.join(blockStatesDir, file))
    }
  }
}

async function readAllBlockModels (dataBase: string, blockModelsDir: string, completePath: string) {
  const actualPath = completePath.length ? completePath + "/" : ""
  const files = fs.readdirSync(blockModelsDir)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const model = JSON.parse(fs.readFileSync(path.join(blockModelsDir, file), 'utf-8'))
      const name = actualPath + file.replace('.json', '')
      currentMcAssets.blocksModels[name] = model
      await loadBlockModelTextures(dataBase, model)
    } else {
      await readAllBlockModels(dataBase, path.join(blockModelsDir, file), actualPath + file)
    }
  }
}

const handleExternalData = async (assetsPathRoot: string, version: string) => {
  const currentVersionNumber = versionToNumber(version)
  const versions = fs.readdirSync(path.join(__dirname, 'data'), { withFileTypes: true })
    .filter(x => x.isDirectory())
    .map(x => x.name)
    .sort((a, b) => versionToNumber(b) - versionToNumber(a))

  const allAssetsVersions = fs.readdirSync(assetsPathRoot, { withFileTypes: true })
    .filter(x => x.isDirectory())
    .map(x => x.name)
    .sort((a, b) => versionToNumber(b) - versionToNumber(a))

  const getAssetsVersion = (version: string) => {
    return allAssetsVersions[version] ?? allAssetsVersions.find(x => x.startsWith(version))
  }

  for (const curVer of versions) {
    const baseDir = path.join(__dirname, 'data', curVer)
    if (versionToNumber(curVer) > currentVersionNumber) continue

    const assetsVersion = getAssetsVersion(curVer)
    await readAllBlockStates(path.join(baseDir, 'blockStates'))
    await readAllBlockModels(path.join(assetsPathRoot, assetsVersion), path.join(baseDir, 'blockModels'), "")
  }
}

export const prepareMoreGeneratedBlocks = async (mcAssets: McAssets) => {
  const mcData = minecraftData(mcAssets.version)
  const allTheBlocks = mcData.blocksArray.map(x => x.name)

  currentMcAssets = mcAssets
  // todo
  const ignoredBlocks = ['skull', 'structure_void', 'banner', 'bed', 'end_portal']

  for (const theBlock of allTheBlocks) {
    try {
      if (await tryHandleBlockEntity(mcAssets.directory, theBlock)) {
        handledBlocks.push(theBlock)
      }
    } catch (err) {
      // todo remove when all warnings are resolved
      console.warn(`[${mcAssets.version}] failed to generate block ${theBlock}`)
    }
  }

  await handleExternalData(path.join(mcAssets.directory, '..'), mcAssets.version)

  const warnings: string[] = []
  for (const [name, model] of Object.entries(mcAssets.blocksModels)) {
    if (Object.keys(model).length === 1 && model.textures) {
      const keys = Object.keys(model.textures)
      if (keys.length === 1 && keys[0] === 'particle') {
        if (handledBlocks.includes(name) || ignoredBlocks.includes(name)) continue
        warnings.push(`unhandled block ${name}`)
      }
    }
  }

  return { warnings }
}

export const getAdditionalTextures = () => {
  return { generated: generatedImageTextures, origSizeTextures }
}
