import * as Tone from 'tone'

// Spoken dialogue lines, one at a time. Like the door sound they play at a fixed level,
// apart from the music volume, which is off by default.
let current: Tone.Player | null = null

export async function playVoice(url: string) {
  stopVoice()
  const player = new Tone.Player().toDestination()
  current = player
  await Tone.start()
  await player.load(url)
  // A newer line, or the end of the conversation, came while this one loaded.
  if (current !== player) return player.dispose()
  player.onstop = () => {
    if (current === player) current = null
    player.dispose()
  }
  player.start()
}

export function stopVoice() {
  const player = current
  current = null
  if (player?.state === 'started') player.stop()
}
