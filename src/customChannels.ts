import { Vec3 } from 'vec3'
import { options } from './optionsStorage'

customEvents.on('mineflayerBotCreated', async () => {
  if (!options.customChannels) return
  await new Promise(resolve => {
    bot.once('login', () => {
      resolve(true)
    })
  })

  const CHANNEL_NAME = 'minecraft-web-client:blockmodels'

  const packetStructure = [
    'container',
    [
      {
        name: 'worldName', // currently not used
        type: ['pstring', { countType: 'i16' }]
      },
      {
        name: 'x',
        type: 'i32'
      },
      {
        name: 'y',
        type: 'i32'
      },
      {
        name: 'z',
        type: 'i32'
      },
      {
        name: 'model',
        type: ['pstring', { countType: 'i16' }]
      }
    ]
  ]

  bot._client.registerChannel(CHANNEL_NAME, packetStructure, true)

  bot._client.on(CHANNEL_NAME as any, (data) => {
    const { worldName, x, y, z, model } = data
    console.debug('Received model data:', { worldName, x, y, z, model })

    if (viewer?.world) {
      const chunkX = Math.floor(x / 16) * 16
      const chunkZ = Math.floor(z / 16) * 16
      const chunkKey = `${chunkX},${chunkZ}`
      const blockPosKey = `${x},${y},${z}`

      const chunkModels = viewer.world.customBlockModels.get(chunkKey) || {}

      if (model) {
        chunkModels[blockPosKey] = model
      } else {
        delete chunkModels[blockPosKey]
      }

      if (Object.keys(chunkModels).length > 0) {
        viewer.world.customBlockModels.set(chunkKey, chunkModels)
      } else {
        viewer.world.customBlockModels.delete(chunkKey)
      }

      // Trigger update
      const block = worldView!.world.getBlock(new Vec3(x, y, z))
      if (block) {
        worldView!.world.setBlockStateId(new Vec3(x, y, z), block.stateId)
      }
    }
  })

  console.debug(`registered custom channel ${CHANNEL_NAME} channel`)
})
