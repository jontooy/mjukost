import { describe, it, expect } from 'vitest'
import { DIALOGUES } from '@/world/dialogue'

describe('DIALOGUES', () => {
  for (const [id, dialogue] of Object.entries(DIALOGUES)) {
    it(`${id}: every reply leads to an existing node and every node can be reached`, () => {
      const ids = Object.keys(dialogue.nodes)
      expect(ids).toContain(dialogue.start)
      const reached = new Set([dialogue.start])
      const queue = [dialogue.start]
      for (let i = 0; i < queue.length; i++) {
        for (const choice of dialogue.nodes[queue[i]!]!.choices) {
          if (choice.next === undefined) continue
          expect(ids, `${queue[i]} -> ${choice.next}`).toContain(choice.next)
          if (reached.has(choice.next)) continue
          reached.add(choice.next)
          queue.push(choice.next)
        }
      }
      expect([...reached].sort()).toEqual([...ids].sort())
    })
  }
})
