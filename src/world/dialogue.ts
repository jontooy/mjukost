import halt from '@/assets/voices/halt.mp3'
import nobody from '@/assets/voices/nobody.mp3'

// Conversations the visitor can have. Add one by naming it in DialogueId and writing its nodes in DIALOGUES.
export type DialogueId = 'gateGuards'

export interface DialogueChoice {
  text: string
  /** Shown after the reply in brackets, e.g. the manner it is said in. */
  tag?: string
  /** Node the conversation moves to; absent ends the conversation. */
  next?: string
}

export interface DialogueNode {
  speaker: string
  text: string
  /** Sound played when the line appears: an mp3 imported from src/assets/voices. */
  voice?: string
  /** The visitor's replies; empty means the speaker has the last word and the box offers Leave. */
  choices: DialogueChoice[]
}

export interface Dialogue {
  start: string
  nodes: Record<string, DialogueNode>
}

export const DIALOGUES: Record<DialogueId, Dialogue> = {
  gateGuards: {
    start: 'halt',
    nodes: {
      halt: {
        speaker: 'Guard',
        voice: halt,
        text: 'Halt! No entries are permitted at this time.',
        choices: [
          { text: 'Do you know who I am?', tag: 'Intimidation', next: 'nobody' },
          { text: "Oh my! I'm so very sorry Sir." },
        ],
      },
      nobody: {
        speaker: 'Guard',
        voice: nobody,
        text: "You're an absolute nobody. Now go away before I make you squeel!",
        choices: [],
      },
    },
  },
}
