import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { defaultSources, MAIN_RESUME_ID } from '../utils/resumeSources'
import { joinText, plainText } from '../utils/richText'
import source from '../data/resume.json'
import type { DocumentBlock, Resume, ResumeDesign, ResumeSource, ResumeVersion } from '../types/resume'


const HISTORY_KEY = 'web-resume-demo:versions:v1'

export type { ResumeVersion } from '../types/resume'

function preferredId(versions: ResumeVersion[]): string {
  return versions[0]!.previousOriginal ? 'original' : versions[0]!.id
}

function initialHistory(): ResumeVersion[] {
  return [{ id: 'original', title: 'Исходное резюме', createdAt: null, resume: structuredClone(source) }]
}


async function requestApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : { cache: 'no-store' })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Сервер резюме недоступен. Запусти приложение через npm run dev или npm run preview.')
  }
  const data = await response.json()
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error
      : 'Не удалось получить данные резюме.'
    throw new Error(message)
  }
  return data as T
}

async function requestHistory(resumeId: string, body?: Record<string, unknown>) {
  const data = await requestApi<ResumeVersion[]>('resume-versions?resumeId=' + encodeURIComponent(resumeId), body)
  if (!Array.isArray(data) || !data.length) throw new Error('Сервер вернул пустую историю.')
  return data
}

function validateLinks(resume: Resume) {
  const links = [
    ...resume.profile.contacts,
    ...resume.profile.preferences,
    ...resume.sections.flatMap(section => section.entries.flatMap(entry =>
      [...(entry.fields ?? []), ...(entry.items ?? [])],
    )),
  ]
  if (links.some(link => link.href && !/^(https?:\/\/|mailto:|tel:)/i.test(link.href.trim()))) {
    throw new Error('Ссылки должны начинаться с https://, http://, mailto: или tel:.')
  }
}

export const useResumeStore = defineStore('resume', () => {


  const sources = ref<ResumeSource[]>([...defaultSources])
  const resumeId = ref(MAIN_RESUME_ID)
  const history = ref<ResumeVersion[]>(initialHistory())
  const historyError = ref('')
  const historyReady = ref(false)
  const selectedId = ref(history.value[0]!.id)
  const activeVersion = computed(() =>
    history.value.find(version => version.id === selectedId.value) ?? history.value[0]!,
  )
  const resume = computed(() => activeVersion.value.resume)
  const viewingLatest = computed(() => activeVersion.value.id === preferredId(history.value))

  function useLatest(versions: ResumeVersion[]) {
    history.value = versions
    selectedId.value = preferredId(versions)
  }

  async function initializeHistory() {
    try {
      const [catalog, mainHistory] = await Promise.all([
        requestApi<ResumeSource[]>('resumes'), requestHistory(MAIN_RESUME_ID),
      ])
      sources.value = catalog
      useLatest(mainHistory)
      let legacy: string | null = null
      try { legacy = localStorage.getItem(HISTORY_KEY) } catch { /* Browser storage is optional. */ }
      if (legacy) {
        useLatest(await requestHistory(MAIN_RESUME_ID, { action: 'migrate', versions: JSON.parse(legacy) }))
        try { localStorage.removeItem(HISTORY_KEY) } catch { /* Retrying the import is safe. */ }
      }
      historyReady.value = true
    } catch (cause) {
      historyError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить историю.'
    }
  }

  async function selectResume(id: string) {
    if (id === resumeId.value) return
    const versions = await requestHistory(id)
    useLatest(versions)
    resumeId.value = id
  }

  async function createResume(draft: Resume, title: string) {
    validateLinks(draft)
    const created = await requestApi<ResumeSource & { history: ResumeVersion[] }>('resumes', { title, resume: draft })
    sources.value.push({ id: created.id, title: created.title })
    useLatest(created.history)
    resumeId.value = created.id
  }

  function selectVersion(id: string) {
    if (history.value.some(version => version.id === id)) selectedId.value = id
  }

  async function addVersion(draft: Resume, title: string, skipIdentical = true) {
    if (!historyReady.value) throw new Error('История ещё не загружена.')
    const snapshot: Resume = JSON.parse(JSON.stringify(draft))
    validateLinks(snapshot)
    useLatest(await requestHistory(resumeId.value, { action: 'save', resume: snapshot, title, skipIdentical }))
  }

  async function deleteVersion(id: string) {
    if (!historyReady.value) throw new Error('История ещё не загружена.')
    const versions = await requestHistory(resumeId.value, { action: 'delete', id })
    history.value = versions
    if (!versions.some(version => version.id === selectedId.value)) {
      selectedId.value = preferredId(versions)
    }
  }

  async function promoteVersion(id: string) {
    if (!historyReady.value) throw new Error('История ещё не загружена.')
    history.value = await requestHistory(resumeId.value, { action: 'promote', id })
    selectedId.value = 'original'
  }

  async function restoreVersion() {
    if (!viewingLatest.value) {
      await addVersion(activeVersion.value.resume, `Восстановлено из «${activeVersion.value.title}»`, false)
    }
  }
  const design = ref<ResumeDesign>('two-column')

  const contentBlocks = computed<DocumentBlock[]>(() => resume.value.sections.flatMap(section => {
    const result: DocumentBlock[] = [{
      id: section.id, kind: 'section', text: section.id === 'section-6' ? 'О себе' : section.title, keepWithNext: true,
    }]
    if (section.text !== undefined) {
      if (!plainText(section.text).trim()) return []
      if (section.text) result.push({ id: `${section.id}-text`, kind: 'description', text: section.text })
      return result
    }
    for (const entry of section.entries) {
      if (entry.title) result.push({ id: `${entry.id}-title`, kind: 'entry', text: entry.title, keepWithNext: true })
      const subtitle = entry.position !== undefined || entry.period !== undefined
        ? joinText([entry.position ?? '', entry.period ?? ''].filter(Boolean), ' · ')
        : entry.subtitle
      if (subtitle) result.push({ id: `${entry.id}-subtitle`, kind: 'subtitle', text: subtitle, keepWithNext: true })
      entry.fields?.filter(field => plainText(field.value).trim()).forEach((field, index) => result.push({
        id: `${entry.id}-field-${index}`, kind: 'field', text: field.value, label: field.label, href: field.href,
      }))
      if (entry.description?.trim()) {
        result.push({ id: `${entry.id}-description`, kind: 'description', text: entry.description })
      }
      entry.paragraphs?.forEach((text, index) => result.push({ id: `${entry.id}-text-${index}`, kind: 'paragraph', text }))
      entry.items?.forEach((item, index) => result.push({ id: `${entry.id}-item-${index}`, kind: 'bullet', ...item }))
    }
    if (section.entries.every(entry => !entry.title && !entry.subtitle && !entry.position && !entry.period &&
      !entry.description && !entry.fields?.some(field => plainText(field.value).trim()) &&
      !entry.paragraphs?.length && !entry.items?.length)) return []
    const last = result.at(-1)
    if (last) last.keepWithNext = false
    return result
  }))

    const blocks = computed<DocumentBlock[]>(() => {
    if (design.value === 'two-column') return contentBlocks.value

    const { profile, sections } = resume.value
    const personalSection = sections.find(section => section.id === 'personal')
    const personalFields = personalSection?.entries.flatMap(entry => entry.fields ?? []) ?? []

    function fieldBlocks(
      prefix: string,
      labels: string[],
      fields: Array<{ label: string; value: string; href?: string }>,
    ): DocumentBlock[] {
      return labels.flatMap((label, index) => {
        const field = fields.find(candidate =>
          plainText(candidate.label).trim() === label && plainText(candidate.value).trim(),
        )
        if (!field) return []

        return [{
          id: `${prefix}-${index}`,
          kind: 'field',
          label: field.label,
          text: field.value,
          href: field.href,
        }]
      })
    }

    const personal = fieldBlocks('single-personal', [
      'Гражданство', 'Место проживания', 'Образование', 'Дата рождения',
    ], personalFields)
    const contacts = fieldBlocks('single-contact', [
      'Телефон', 'Почта', 'Telegram', 'GitHub',
    ], profile.contacts)
    const preferences = fieldBlocks('single-preference', [
      'Тип занятости', 'Формат работы',
    ], profile.preferences)

    const introFields: DocumentBlock[] = []
    for (const group of [personal, contacts, preferences]) {
      const firstField = group[0]
      if (!firstField) continue
      if (introFields.length) firstField.startsGroup = true
      introFields.push(...group)
    }

    const remainingBlocks = contentBlocks.value.filter(block =>
      block.id !== 'personal' &&
      !personalSection?.entries.some(entry => block.id.startsWith(`${entry.id}-`)),
    )

    if (!introFields.length) return remainingBlocks

    return [
      { id: 'personal', kind: 'section', text: 'Личная информация', keepWithNext: true },
      ...introFields,
      ...remainingBlocks,
    ]
  })

  return { sources, resumeId, selectResume, createResume, resume, design, blocks, history, historyError, historyReady, initializeHistory, activeVersion, viewingLatest, selectVersion, addVersion, restoreVersion, deleteVersion, promoteVersion }
})
