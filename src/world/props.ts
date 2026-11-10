import * as THREE from 'three'
import type { Post } from '@/types/post'
import { AsciiImage } from '@/ascii/image'
import { surface } from '@/ascii/surfaces'
import type { WorldText } from '@/ascii/worldText'

export const PAINTING_WIDTH = 1.2
export const PAINTING_HEIGHT = 1.5

const TITLE = '#ffd479'
const DATE = '#b8a888'
const BODY = '#f3e3b5'

export function createPainting(post: Post, frameColor: THREE.ColorRepresentation) {
  return framed(posterText(post), frameColor)
}

// A poster shown when the posts could not be loaded: a crossed-out mjukost.
export function createOfflinePainting(frameColor: THREE.ColorRepresentation) {
  return framed(
    [
      { text: 'x_x', colour: TITLE },
      { text: 'offline', colour: DATE },
    ],
    frameColor,
  )
}

function posterText(post: Post): WorldText {
  const lines: WorldText = []
  if (post.title) lines.push({ text: post.title, colour: TITLE })
  lines.push({ text: new Date(post.created_at).toLocaleDateString(), colour: DATE })
  if (post.image_ascii) lines.push({ text: '', colour: DATE, image: new AsciiImage(post.image_ascii) })
  else if (/!\[[^\]]*\]\(/.test(post.body)) lines.push({ text: '[image]', colour: DATE })
  lines.push({ text: '', colour: BODY })
  for (const line of stripMarkdown(post.body).split('\n')) lines.push({ text: line, colour: BODY })
  return lines
}

// Plain text for the poster; line breaks stay, runs of spaces and three or more breaks shrink.
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#*_>~]+/g, '$1')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function framed(text: WorldText, frameColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(PAINTING_WIDTH + 0.16, PAINTING_HEIGHT + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.2, ...surface('wood') }),
  )
  frame.castShadow = true
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT),
    new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.9, ...surface('parchment') }),
  )
  canvas.userData.asciiText = text
  canvas.position.z = 0.045
  group.add(frame, canvas)
  return group
}

// An empty poster: a frame with blank, faintly glowing parchment, waiting for the next entry.
export function createBlankPainting(frameColor: THREE.ColorRepresentation) {
  const group = new THREE.Group()
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(PAINTING_WIDTH + 0.16, PAINTING_HEIGHT + 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.6, metalness: 0.2, ...surface('wood') }),
  )
  frame.castShadow = true
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(PAINTING_WIDTH, PAINTING_HEIGHT),
    new THREE.MeshStandardMaterial({ color: '#d9cfb4', emissive: '#3a3020', roughness: 1, ...surface('parchment') }),
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
