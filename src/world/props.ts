import * as THREE from 'three'
import type { Post } from '@/types/post'
import { createPostTexture, getOfflineTexture } from '@/world/postTexture'

export const PAINTING_WIDTH = 1.2
export const PAINTING_HEIGHT = 1.5

export function createPainting(post: Post, frameColor: THREE.ColorRepresentation) {
  return framed(new THREE.MeshStandardMaterial({ map: createPostTexture(post), roughness: 0.9 }), frameColor)
}

// A poster shown when the posts could not be loaded: a crossed-out mjukost.
export function createOfflinePainting(frameColor: THREE.ColorRepresentation) {
  return framed(new THREE.MeshStandardMaterial({ map: getOfflineTexture(), roughness: 0.9 }), frameColor)
}

function framed(material: THREE.Material, frameColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(PAINTING_WIDTH + 0.16, PAINTING_HEIGHT + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.2 }),
  )
  frame.castShadow = true
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT), material)
  canvas.position.z = 0.045
  group.add(frame, canvas)
  return group
}

// An empty poster: a frame with blank, faintly glowing parchment, waiting for the next entry.
export function createBlankPainting(frameColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(PAINTING_WIDTH + 0.16, PAINTING_HEIGHT + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.2 }),
  )
  frame.castShadow = true
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT),
    new THREE.MeshStandardMaterial({ color: '#d9cfb4', emissive: '#3a3020', roughness: 1 }),
  )
  sheet.position.z = 0.045
  group.add(frame, sheet)
  return group
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh)) return
    node.geometry.dispose()
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose()
      }
      material.dispose()
    }
  })
}
