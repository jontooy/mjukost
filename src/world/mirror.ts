import * as THREE from 'three'

type Facing = 'user' | 'environment'

const GLASS_RADIUS = 0.16

export class HandMirror {
  readonly group = new THREE.Group()
  readonly glass: THREE.Mesh<THREE.CircleGeometry, THREE.Material>
  live = false

  private facing: Facing = 'user'
  private stream: MediaStream | null = null
  private readonly video = document.createElement('video')
  private readonly idleMaterial = new THREE.MeshStandardMaterial({
    color: '#cfd8dc',
    metalness: 1,
    roughness: 0.15,
  })
  private readonly liveMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.VideoTexture(this.video),
  })

  constructor() {
    this.video.muted = true
    this.video.playsInline = true
    this.liveMaterial.map!.colorSpace = THREE.SRGBColorSpace

    const brass = new THREE.MeshStandardMaterial({
      color: '#b08d57',
      metalness: 0.8,
      roughness: 0.35,
    })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(GLASS_RADIUS + 0.02, 0.025, 10, 40), brass)
    const back = new THREE.Mesh(new THREE.CircleGeometry(GLASS_RADIUS + 0.02, 40), brass)
    back.position.z = -0.01
    back.rotation.y = Math.PI
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.26, 10), brass)
    handle.position.y = -GLASS_RADIUS - 0.15
    this.glass = new THREE.Mesh(new THREE.CircleGeometry(GLASS_RADIUS, 40), this.idleMaterial)
    this.glass.position.z = 0.002
    this.group.add(rim, back, handle, this.glass)
  }

  async start() {
    this.stop()
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser has no camera')
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facing } },
        audio: false,
      })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError') throw new Error('Camera permission was denied')
      if (name === 'NotFoundError') throw new Error('No camera was found')
      throw error
    }
    this.video.srcObject = this.stream
    await this.video.play()
    this.fitVideo()
    this.glass.material = this.liveMaterial
    this.live = true
  }

  async flip() {
    this.facing = this.facing === 'user' ? 'environment' : 'user'
    await this.start()
  }

  async capture(): Promise<File> {
    const canvas = document.createElement('canvas')
    canvas.width = this.video.videoWidth
    canvas.height = this.video.videoHeight
    const context = canvas.getContext('2d')!
    if (this.facing === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(this.video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) throw new Error('Failed to capture photo')
    return new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.video.srcObject = null
    this.glass.material = this.idleMaterial
    this.live = false
  }

  dispose() {
    this.stop()
    this.liveMaterial.map!.dispose()
  }

  private fitVideo() {
    const texture = this.liveMaterial.map!
    const aspect = this.video.videoWidth / this.video.videoHeight
    const width = aspect > 1 ? 1 / aspect : 1
    const height = aspect > 1 ? 1 : aspect
    const mirrored = this.facing === 'user'
    texture.repeat.set(mirrored ? -width : width, height)
    texture.offset.set(mirrored ? (1 + width) / 2 : (1 - width) / 2, (1 - height) / 2)
  }
}
