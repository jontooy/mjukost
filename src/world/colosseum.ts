import * as THREE from 'three'
import { EYE_HEIGHT, type World } from '@/world/engine'
import { ARENA_A, createColosseumBuilding, ellipseScale } from '@/world/colosseumModel'
import { disposeObject } from '@/world/props'
import { surface } from '@/ascii/surfaces'

const SKY = '#9db8d6'
const SHADOW_EXTENT = 60
const BODY = 0.5

// Inside the Colosseum: the sand under an open sky, ringed by the stands. Visitors arrive through
// the east gate, the way back out to the forest.
export function createColosseum(): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY)
  scene.fog = new THREE.Fog(SKY, 90, 260)

  scene.add(new THREE.HemisphereLight('#e8eef5', '#6b5a3e', 1.3))
  const sun = new THREE.DirectionalLight('#fff0d0', 2)
  sun.position.set(-40, 80, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_EXTENT,
    right: SHADOW_EXTENT,
    top: SHADOW_EXTENT,
    bottom: -SHADOW_EXTENT,
    far: 200,
  })
  scene.add(sun, sun.target)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: '#6f7a4c', roughness: 1, ...surface('grass') }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground, createColosseumBuilding({ grandGate: false }))

  // A few steps in from the east gate, facing down the long axis.
  const gate = { position: new THREE.Vector3(ARENA_A - 4, EYE_HEIGHT, 0), yaw: Math.PI / 2 }
  return {
    name: 'colosseum',
    scene,
    spawn: gate,
    arrivals: { forest: gate },
    interactables: [],
    portals: [{ position: new THREE.Vector3(ARENA_A - BODY + 0.2, EYE_HEIGHT, 0), radius: 1.2, to: 'forest' }],
    // The podium wall round the sand holds visitors in.
    clamp(position) {
      const scale = ellipseScale(position.x, position.z, -BODY)
      if (scale <= 1) return
      position.x /= scale
      position.z /= scale
    },
    dispose: () => disposeObject(scene),
  }
}
