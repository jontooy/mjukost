import * as THREE from 'three'
import { convertFrame, idDepth } from './convert'
import { Screen } from './screen'
import { surfaceIndex } from './surfaces'
import { drawWorldText, projectRect, type WorldText } from './worldText'

const ID_VERTEX = /* glsl */ `
varying float vViewZ;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  vViewZ = -mvPosition.z;
}
`

const ID_FRAGMENT = /* glsl */ `
uniform float uSurface;
varying float vViewZ;
void main() {
  float d = floor(clamp(vViewZ / 400.0, 0.0, 1.0) * 65535.0);
  float hi = floor(d / 256.0);
  gl_FragColor = vec4(uSurface / 255.0, hi / 255.0, (d - hi * 256.0) / 255.0, 1.0);
}
`

const world = new THREE.Vector3()
const view = new THREE.Vector3()

/**
 * Renders a three.js scene at one pixel per grid cell, twice: a lit colour
 * pass and a surface-id/depth pass. Both are read back and turned into glyphs.
 * With `enabled` off, the scene is drawn plainly to `viewCanvas` instead; the
 * ID pass still runs so post text drawn into the grid stays hidden behind walls.
 */
export class AsciiRenderer {
  readonly screen: Screen
  enabled = true
  private readonly gl: THREE.WebGLRenderer
  private readonly idTarget: THREE.WebGLRenderTarget
  private readonly view: THREE.WebGLRenderer
  private readonly idMaterials = new Map<number, THREE.ShaderMaterial>()
  private colourBuf = new Uint8Array(0)
  private idBuf = new Uint8Array(0)
  private readonly meshes: THREE.Mesh[] = []
  private readonly materials: THREE.Material[] = []
  private readonly points: THREE.Points[] = []
  private readonly texts: THREE.Mesh[] = []

  constructor(canvas: HTMLCanvasElement, viewCanvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas)
    this.gl = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false })
    this.gl.setPixelRatio(1)
    this.gl.shadowMap.enabled = true
    this.gl.shadowMap.autoUpdate = false
    this.view = new THREE.WebGLRenderer({ canvas: viewCanvas, antialias: true })
    this.view.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)) // full res with shadows is costly
    this.view.shadowMap.enabled = true
    this.idTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    })
    this.resize()
  }

  resize(): void {
    const { screen } = this
    screen.resize()
    this.gl.setSize(screen.cols, screen.rows, false)
    this.view.setSize(screen.width, screen.height, false)
    this.idTarget.setSize(screen.cols, screen.rows)
    this.colourBuf = new Uint8Array(screen.cols * screen.rows * 4)
    this.idBuf = new Uint8Array(screen.cols * screen.rows * 4)
  }

  /** Fills the screen grid from the scene; the caller blits. */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, t: number): void {
    const { gl, screen, meshes, materials, points, texts } = this
    const { cols, rows } = screen

    meshes.length = 0
    materials.length = 0
    points.length = 0
    texts.length = 0
    scene.traverseVisible((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh
        meshes.push(mesh)
        materials.push(mesh.material as THREE.Material)
        if (mesh.userData.asciiText) texts.push(mesh)
      } else if ((object as THREE.Points).isPoints) {
        points.push(object as THREE.Points)
      }
    })

    for (const p of points) p.visible = false

    if (this.enabled) {
      gl.setRenderTarget(null)
      gl.shadowMap.needsUpdate = true
      gl.render(scene, camera)
      const c = gl.getContext()
      c.readPixels(0, 0, cols, rows, c.RGBA, c.UNSIGNED_BYTE, this.colourBuf)
    }

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i]!
      const material = materials[i]!
      const name = material.userData.surface
      if (material.transparent && name === undefined) mesh.visible = false
      else mesh.material = this.idMaterial(surfaceIndex(name), material.side)
    }
    const background = scene.background
    scene.background = null
    gl.setClearColor(0x00ffff, 1)
    gl.setRenderTarget(this.idTarget)
    gl.render(scene, camera)
    gl.readRenderTargetPixels(this.idTarget, 0, 0, cols, rows, this.idBuf)
    gl.setRenderTarget(null)
    for (let i = 0; i < meshes.length; i++) {
      meshes[i]!.material = materials[i]!
      meshes[i]!.visible = true
    }
    scene.background = background
    gl.setClearColor(0x000000, 1)

    for (const p of points) p.visible = true

    screen.clear()
    if (!this.enabled) {
      this.view.render(scene, camera)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) screen.depth[y * cols + x] = idDepth(this.idBuf, ((rows - 1 - y) * cols + x) * 4)
      }
    } else {
      const e = camera.matrixWorld.elements
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const sx = tanHalf * camera.aspect
      convertFrame(screen, {
        colour: this.colourBuf,
        ids: this.idBuf,
        eye: [e[12]!, e[13]!, e[14]!],
        forward: [-e[8]!, -e[9]!, -e[10]!],
        right: [e[0]! * sx, e[1]! * sx, e[2]! * sx],
        up: [e[4]! * tanHalf, e[5]! * tanHalf, e[6]! * tanHalf],
        rowsPerMetre: rows / (2 * tanHalf),
        t,
      })

      for (const p of points) {
        const colour = '#' + (p.material as THREE.PointsMaterial).color.getHexString()
        const position = p.geometry.getAttribute('position')
        for (let i = 0; i < position.count; i++) {
          world.fromBufferAttribute(position, i).applyMatrix4(p.matrixWorld)
          const depth = -view.copy(world).applyMatrix4(camera.matrixWorldInverse).z
          if (depth <= camera.near) continue
          world.project(camera)
          const cx = Math.floor(((world.x + 1) / 2) * cols)
          const cy = Math.floor(((1 - world.y) / 2) * rows)
          if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue
          if (depth < screen.depth[cy * cols + cx]!) screen.setDepth(cx, cy, depth < 10 ? '*' : '.', colour, depth)
        }
      }
    }

    for (const mesh of texts) {
      const rect = projectRect(mesh, camera, cols, rows)
      if (rect) drawWorldText(screen, rect, mesh.userData.asciiText as WorldText)
    }
  }

  dispose(): void {
    this.gl.dispose()
    this.view.dispose()
    this.idTarget.dispose()
    for (const material of this.idMaterials.values()) material.dispose()
  }

  private idMaterial(index: number, side: THREE.Side): THREE.ShaderMaterial {
    const key = index * 3 + side
    let material = this.idMaterials.get(key)
    if (!material) {
      material = new THREE.ShaderMaterial({
        vertexShader: ID_VERTEX,
        fragmentShader: ID_FRAGMENT,
        side,
        uniforms: { uSurface: { value: index } },
      })
      this.idMaterials.set(key, material)
    }
    return material
  }
}
