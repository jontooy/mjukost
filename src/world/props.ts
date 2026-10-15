import * as THREE from 'three'
import type { Post } from '@/types/post'
import { createPostTexture } from '@/world/postTexture'

export const PAINTING_WIDTH = 1.2
export const PAINTING_HEIGHT = 1.5

export function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export function createPainting(post: Post, frameColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(PAINTING_WIDTH + 0.16, PAINTING_HEIGHT + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.2 }),
  )
  frame.castShadow = true
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT),
    new THREE.MeshStandardMaterial({ map: createPostTexture(post), roughness: 0.9 }),
  )
  canvas.position.z = 0.045
  group.add(frame, canvas)
  return group
}

export function createDesk(woodColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.8 })
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), wood)
  top.position.y = 1
  top.rotation.x = -0.3
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), wood)
  leg.position.y = 0.5
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.65),
    new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 1 }),
  )
  paper.position.set(0, 1.05, 0)
  paper.rotation.x = -Math.PI / 2 - 0.3
  const quill = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.45, 5),
    new THREE.MeshStandardMaterial({ color: '#f5f5f0', emissive: '#443322' }),
  )
  quill.position.set(0.4, 1.25, 0)
  quill.rotation.z = -0.5
  group.add(top, leg, paper, quill)
  group.traverse((node) => (node.castShadow = true))
  return group
}

export function createPortalSurface(
  color: THREE.ColorRepresentation,
  width: number,
  height: number,
) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p * vec2(1.0, 0.7));
        float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 + r * 18.0 - time * 2.5) * 0.5 + 0.5;
        float glow = smoothstep(0.55, 0.0, r);
        gl_FragColor = vec4(color * (0.6 + swirl * 0.8), glow * (0.55 + swirl * 0.45));
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  return { mesh, tick: (elapsed: number) => (material.uniforms.time!.value = elapsed) }
}

export function disposeScene(scene: THREE.Scene) {
  scene.traverse((node) => {
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
