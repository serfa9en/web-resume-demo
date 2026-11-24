import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { blankResume, defaultSources, MAIN_RESUME_ID } from '../src/utils/resumeSources'
import type { Resume, ResumeSource } from '../src/types/resume'
import type { ResumeVersion } from '../src/stores/resume'

const mainDirectory = fileURLToPath(new URL('../src/data/versions/', import.meta.url))
const sourcesDirectory = fileURLToPath(new URL('../src/data/resumes/', import.meta.url))
const legacyFile = fileURLToPath(new URL('../resume-data/history.json', import.meta.url))
const seedFile = fileURLToPath(new URL('../src/data/resume.json', import.meta.url))
const sourcesRoute = '/api/resumes'
const route = '/api/resume-versions'

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validHref(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' &&
    (!value.trim() || /^(https?:\/\/|mailto:|tel:)/i.test(value.trim())))
}

function validField(field: Resume['profile']['preferences'][number]): boolean {
  return !!field && typeof field.label === 'string' &&
    typeof field.value === 'string' && validHref(field.href)
}

function validResume(value: unknown): value is Resume {
  if (!value || typeof value !== 'object') return false
  const resume = value as Resume
  const profile = resume.profile
  if (!profile || ![profile.name, profile.role, profile.salary, profile.photo, profile.birthDate]
    .every(item => typeof item === 'string')) return false
  return Array.isArray(profile.contacts) && profile.contacts.every(validField) &&
    Array.isArray(profile.preferences) && profile.preferences.every(validField) &&
    stringList(profile.tags) &&
    Array.isArray(resume.sections) && resume.sections.every(section => section &&
      typeof section.id === 'string' && typeof section.title === 'string' &&
      (section.text === undefined || typeof section.text === 'string') &&
      Array.isArray(section.entries) && section.entries.every(entry => entry &&
        typeof entry.id === 'string' &&
        (entry.title === undefined || typeof entry.title === 'string') &&
        [entry.subtitle, entry.position, entry.period, entry.description].every(value =>
          value === undefined || typeof value === 'string',
        ) &&
        (entry.fields === undefined || (Array.isArray(entry.fields) && entry.fields.every(validField))) &&
        (entry.paragraphs === undefined || stringList(entry.paragraphs)) &&
        (entry.items === undefined || (Array.isArray(entry.items) && entry.items.every(item =>
          item && typeof item.text === 'string' && validHref(item.href) &&
          (item.achievement === undefined || typeof item.achievement === 'boolean') &&
          (item.depth === undefined || String(item.depth) === '' || Number.isFinite(item.depth)),
        ))),
      ),
    )
}

function validVersion(value: unknown): value is ResumeVersion {
  const version = value as ResumeVersion | null
  return !!version && typeof version.id === 'string' && typeof version.title === 'string' &&
    (version.createdAt === null || (typeof version.createdAt === 'string' && Number.isFinite(Date.parse(version.createdAt)))) &&
    validResume(version.resume)
}

const versionFilename = /^version_\d{2}-\d{2}-\d{4}_\d{2}-\d{2}\.json$/
const timeZone = 'Asia/Yekaterinburg'
const filenameDate = new Intl.DateTimeFormat('en-GB', {
  timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function makeFilename(savedAt: string): string {
  const parts = Object.fromEntries(filenameDate.formatToParts(new Date(savedAt))
    .map(({ type, value }) => [type, value]))
  return `version_${parts.day}-${parts.month}-${parts.year}_${parts.hour}-${parts.minute}.json`
}

interface SavedSource extends ResumeSource {
  resume: Resume
}

const customId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function versionsDirectory(id: string): string {
  return id === MAIN_RESUME_ID ? mainDirectory : join(sourcesDirectory, id, 'versions')
}

async function listSources(): Promise<ResumeSource[]> {
  await mkdir(sourcesDirectory, { recursive: true })
  const result = [...defaultSources]
  const folders = await readdir(sourcesDirectory, { withFileTypes: true })
  for (const folder of folders) {
    if (!folder.isDirectory() || !customId.test(folder.name)) continue
    try {
      const { id, title } = await readCustomSource(folder.name)
      result.push({ id, title })
    } catch (cause) {
      if (!(cause instanceof RequestError && cause.status === 404)) throw cause
    }
  }
  return result
}

async function readCustomSource(id: string): Promise<SavedSource> {
  if (!customId.test(id)) throw new RequestError(404, 'Исходное резюме не найдено.')
  try {
    const data: SavedSource = JSON.parse(await readFile(join(sourcesDirectory, id, 'resume.json'), 'utf8'))
    if (data.id !== id || typeof data.title !== 'string' || !validResume(data.resume)) {
      throw new Error('Invalid resume source: ' + id)
    }
    return data
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new RequestError(404, 'Исходное резюме не найдено.')
    }
    throw cause
  }
}

async function readSource(id: string): Promise<SavedSource> {
  const builtin = defaultSources.find(item => item.id === id)
  if (!builtin) return readCustomSource(id)
  if (id !== MAIN_RESUME_ID) return { ...builtin, resume: blankResume() }
  const resume: unknown = JSON.parse(await readFile(seedFile, 'utf8'))
  if (!validResume(resume)) throw new Error('Invalid initial resume')
  return { ...builtin, resume }
}

async function createSource(body: Record<string, unknown>) {
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 100 ||
    !validResume(body.resume)) {
    throw new RequestError(400, 'Укажи название резюме до 100 символов и проверь данные.')
  }
  const id = randomUUID()
  const folder = join(sourcesDirectory, id)
  await mkdir(folder, { recursive: true })
  await replaceJson(join(folder, 'resume.json'), { id, title: body.title.trim(), resume: body.resume })
  return { id, title: body.title.trim(), history: [{ id: 'original', title: 'Исходное резюме', createdAt: null, resume: body.resume }] }
}

async function saveVersion(directory: string, version: ResumeVersion) {
  if (!version.createdAt) throw new Error('A saved version must have a timestamp')
  const filename = makeFilename(version.createdAt)
  await mkdir(directory, { recursive: true })
  const temp = join(directory, '.' + randomUUID() + '.tmp')
  try {
    await writeFile(temp, JSON.stringify(version, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
    // Additional saves in the same minute keep the same filename in numbered folders.
    for (let slot = 1; ; slot++) {
      const destination = slot === 1 ? directory : join(directory, String(slot))
      await mkdir(destination, { recursive: true })
      try {
        // Publish the complete file without overwriting a version already there.
        await link(temp, join(destination, filename))
        return
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
      }
    }
  } finally {
    await rm(temp, { force: true })
  }
}

async function readVersionFiles(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  const versions: { version: ResumeVersion; slot: number; path: string }[] = []

  async function readFolder(folder: string, slot: number, files: typeof entries) {
    for (const entry of files) {
      if (!entry.isFile() || !versionFilename.test(entry.name)) continue
      const path = join(folder, entry.name)
      const data: unknown = JSON.parse(await readFile(path, 'utf8'))
      if (!validVersion(data) || !data.createdAt) throw new Error(`Invalid version file: ${entry.name}`)
      versions.push({ version: data, slot, path })
    }
  }

  await readFolder(directory, 1, entries)
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[1-9]\d*$/.test(entry.name) || Number(entry.name) < 2) continue
    const folder = join(directory, entry.name)
    await readFolder(folder, Number(entry.name), await readdir(folder, { withFileTypes: true }))
  }
  return versions.sort((a, b) =>
    Date.parse(b.version.createdAt!) - Date.parse(a.version.createdAt!) || b.slot - a.slot,
  )
}

async function importVersions(directory: string, versions: ResumeVersion[], current: ResumeVersion[]) {
  const ids = new Set([...await readDeletedIds(directory), ...current.map(version => version.id)])
  for (const version of versions) {
    if (!version.createdAt || ids.has(version.id)) continue
    await saveVersion(directory, version)
    ids.add(version.id)
  }
}

async function readLegacyHistory(): Promise<ResumeVersion[]> {
  let content: string
  try {
    content = await readFile(legacyFile, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw cause
  }
  const history: unknown = JSON.parse(content)
  if (!Array.isArray(history) || !history.every(validVersion)) throw new Error('Invalid legacy history')
  return history
}

async function loadHistory(source: SavedSource): Promise<ResumeVersion[]> {
  const directory = versionsDirectory(source.id)
  await mkdir(directory, { recursive: true })
  const versions = (await readVersionFiles(directory)).map(({ version }) => version)
  return [...versions, { id: 'original', title: 'Исходное резюме', createdAt: null, resume: source.resume }]
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new RequestError(415, 'Ожидается JSON.')
  }
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length <= 12 * 1024 * 1024) chunks.push(chunk)
  }
  if (length > 12 * 1024 * 1024) throw new RequestError(413, 'Слишком большой объём данных для одного запроса.')
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (body && typeof body === 'object' && !Array.isArray(body)) return body
  } catch {
    // Invalid JSON uses the same response as an invalid object.
  }
  throw new RequestError(400, 'Некорректный JSON.')
}

async function readDeletedIds(directory: string): Promise<string[]> {
  let content: string
  try {
    content = await readFile(join(directory, '.deleted-ids.json'), 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw cause
  }
  const ids: unknown = JSON.parse(content)
  if (!stringList(ids)) throw new Error('Invalid deleted version IDs')
  return ids
}

async function replaceJson(path: string, value: unknown) {
  const temp = path + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true })
  }
}

async function deleteVersion(source: SavedSource, id: string) {
  const directory = versionsDirectory(source.id)
  if (id === 'original') throw new RequestError(400, 'Исходное резюме удалить нельзя.')

  const matching = (await readVersionFiles(directory)).filter(file => file.version.id === id)
  if (!matching.length) return loadHistory(source)

  // Record only the ID so old browser copies cannot reimport the deleted version.
  const deleted = await readDeletedIds(directory)
  if (!deleted.includes(id)) await replaceJson(join(directory, '.deleted-ids.json'), [...deleted, id])

  if (source.id === MAIN_RESUME_ID) {
    const legacy = await readLegacyHistory()
    const remaining = legacy.filter(version => version.id !== id)
    if (remaining.length !== legacy.length) await replaceJson(legacyFile, remaining)
  }

  for (const file of matching) await rm(file.path, { force: true })
  return loadHistory(source)
}

async function applyChange(source: SavedSource, body: Record<string, unknown>, history: ResumeVersion[]) {
  const directory = versionsDirectory(source.id)
  if (body.action === 'delete') {
    if (typeof body.id !== 'string' || !body.id) {
      throw new RequestError(400, 'Не указана версия для удаления.')
    }
    return deleteVersion(source, body.id)
  }

  if (body.action === 'migrate') {
    if (!Array.isArray(body.versions) || !body.versions.every(validVersion)) {
      throw new RequestError(400, 'Старые версии имеют неверный формат.')
    }
    if (source.id !== MAIN_RESUME_ID) throw new RequestError(400, 'Старая история относится к основному резюме.')
    await importVersions(directory, body.versions, history)
    return loadHistory(source)
  }

  if (body.action !== 'save' || typeof body.title !== 'string' || !validResume(body.resume)) {
    throw new RequestError(400, 'Не удалось прочитать данные версии.')
  }
  if (body.skipIdentical !== false && JSON.stringify(history[0]!.resume) === JSON.stringify(body.resume)) {
    return history
  }
  const version: ResumeVersion = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    title: body.title.trim() || `Версия ${history.length + 1}`,
    resume: body.resume,
  }
  await saveVersion(directory, version)
  return loadHistory(source)
}

export function resumeHistoryPlugin(): Plugin {
  let queue: Promise<unknown> = Promise.resolve()
  let legacyImported = false

  function middleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== route && url.pathname !== sourcesRoute) return next()
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')

    void (async () => {
      try {
        const origin = request.headers.origin
        if (request.headers['sec-fetch-site'] === 'cross-site' ||
          (origin && new URL(origin).host !== request.headers.host)) {
          throw new RequestError(403, 'Запрос должен исходить из приложения.')
        }
        if (request.method !== 'GET' && request.method !== 'POST') {
          throw new RequestError(405, 'Метод не поддерживается.')
        }
        const body = request.method === 'POST' ? await readBody(request) : undefined
        const operation = queue.then(async () => {
          if (url.pathname === sourcesRoute) return body ? createSource(body) : listSources()

          const source = await readSource(url.searchParams.get('resumeId') ?? MAIN_RESUME_ID)
          let history = await loadHistory(source)
          if (source.id === MAIN_RESUME_ID && !legacyImported) {
            const legacy = await readLegacyHistory()
            if (legacy.length) {
              await importVersions(mainDirectory, legacy, history)
              history = await loadHistory(source)
            }
            legacyImported = true
          }
          return body ? applyChange(source, body, history) : history
        })
        queue = operation.catch(() => undefined)
        response.end(JSON.stringify(await operation))
      } catch (cause) {
        response.statusCode = cause instanceof RequestError ? cause.status : 500
        if (!(cause instanceof RequestError)) console.error('Resume history:', cause)
        response.end(JSON.stringify({
          error: cause instanceof RequestError ? cause.message :
            'Не удалось прочитать или записать историю в src/data/versions. Проверь JSON-файлы и права на запись.',
        }))
      }
    })()
  }

  return {
    name: 'resume-history',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
