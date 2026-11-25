import type { ResumeEntry } from '../types/resume'
import { joinText } from './richText'

export function editableWorkDescription(entry: ResumeEntry): string {
  if (entry.description !== undefined) return entry.description
  return joinText([
    ...(entry.paragraphs ?? []),
    ...(entry.items ?? []).map(item => {
      const indent = '  '.repeat(Math.max(0, Math.min(6, Number(item.depth) || 0)))
      return joinText([
        indent + (item.achievement ? '✓ ' : '• '),
        item.text,
        ...(item.href ? [' (' + item.href + ')'] : []),
      ])
    }),
  ], '\n')
}

export function replaceWorkDescription(entry: ResumeEntry, description: string): void {
  if (description === editableWorkDescription(entry)) return
  entry.description = description
  delete entry.paragraphs
  delete entry.items
}
