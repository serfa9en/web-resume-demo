import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import source from '../data/resume.json'
import type { DocumentBlock, Resume } from '../types/resume'

export const useResumeStore = defineStore('resume', () => {
  // JSON is the source of truth. No database or server is required for this step.
  const resume = ref<Resume>(structuredClone(source))

  const blocks = computed<DocumentBlock[]>(() => resume.value.sections.flatMap(section => {
    const result: DocumentBlock[] = [{
      id: section.id, kind: 'section', text: section.title, keepWithNext: true,
    }]
    for (const entry of section.entries) {
      if (entry.title) result.push({ id: `${entry.id}-title`, kind: 'entry', text: entry.title, keepWithNext: true })
      if (entry.subtitle) result.push({ id: `${entry.id}-subtitle`, kind: 'subtitle', text: entry.subtitle, keepWithNext: true })
      entry.fields?.forEach((field, index) => result.push({
        id: `${entry.id}-field-${index}`, kind: 'field', text: field.value, label: field.label, href: field.href,
      }))
      entry.paragraphs?.forEach((text, index) => result.push({ id: `${entry.id}-text-${index}`, kind: 'paragraph', text }))
      entry.items?.forEach((item, index) => result.push({ id: `${entry.id}-item-${index}`, kind: 'bullet', ...item }))
    }
    // An empty section is still displayable and must not bind to the next section.
    const last = result.at(-1)
    if (last) last.keepWithNext = false
    return result
  }))

  return { resume, blocks }
})
