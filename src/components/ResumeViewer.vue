<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useResumeStore } from '../stores/resume'
import ResumePage from './resume/ResumePage.vue'
import ResumeHeader from './resume/ResumeHeader.vue'
import ResumeBlock from './resume/ResumeBlock.vue'
import ResumeEditor from './ResumeEditor.vue'
import ResumeHistory from './ResumeHistory.vue'
import '../styles/editor.css'
import { plainText, textHtml } from '../utils/richText'
import { paginate } from '../utils/paginate'
import type { DocumentBlock, Resume, ResumePage as Page } from '../types/resume'

const store = useResumeStore()
const { resume, design, blocks, history, historyError, historyReady, activeVersion, viewingLatest } = storeToRefs(store)

const editorOpen = ref(false)
const editorError = ref('')
const savingVersion = ref(false)
const restoringVersion = ref(false)
const versionActionError = ref('')

function openEditor() {
  editorError.value = ''
  editorOpen.value = true
}

async function saveVersion(draft: Resume, title: string) {
  if (savingVersion.value) return
  savingVersion.value = true
  editorError.value = ''
  try {
    await store.addVersion(draft, title)
    editorOpen.value = false
    versionActionError.value = ''
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : 'Не удалось сохранить версию.'
  } finally {
    savingVersion.value = false
  }
}

function selectVersion(id: string) {
  versionActionError.value = ''
  store.selectVersion(id)
}

async function restoreVersion() {
  if (restoringVersion.value) return
  restoringVersion.value = true
  try {
    await store.restoreVersion()
    versionActionError.value = ''
  } catch (cause) {
    versionActionError.value = cause instanceof Error ? cause.message : 'Не удалось восстановить версию.'
  } finally {
    restoringVersion.value = false
  }
}

const pages = ref<Page[]>([])
const error = ref('')
const busy = ref(true)
const zoom = ref('fit')
const stage = ref<HTMLElement>()
const firstMeasure = ref<HTMLElement>()
const nextMeasure = ref<HTMLElement>()
const stageWidth = ref(900)
let resizeObserver: ResizeObserver | undefined
let generation = 0
let disposed = false

const a4Width = 210 * 96 / 25.4
const a4Height = 297 * 96 / 25.4
const scale = computed(() => zoom.value === 'fit'
  ? Math.min(1, Math.max(0.15, (stageWidth.value - 40) / a4Width))
  : Number(zoom.value) / 100)
const pageStyle = computed(() => ({ width: `${a4Width * scale.value}px`, height: `${a4Height * scale.value}px` }))

async function layout() {
  const run = ++generation
  busy.value = true
  error.value = ''
  await nextTick()
  await document.fonts.ready
  if (disposed || run !== generation) return
  try {
    const sheets = [firstMeasure.value!, nextMeasure.value!]
    const columns = sheets.map(sheet => sheet.querySelector<HTMLElement>('.page-main')!)
    const capacities = sheets.map((sheet, i) => {
      const bottom = sheet.querySelector('.resume-page-footer')!.getBoundingClientRect().top
      return bottom - columns[i]!.getBoundingClientRect().top - 14
    })
    const sources = columns.map(column => new Map(
      Array.from(column.children).map((element, i) => [blocks.value[i]!.id, element]),
    ))
    const cache = new Map<string, number>()
    const measure = (block: DocumentBlock, first: boolean) => {
      const key = JSON.stringify([first, block])
      const cached = cache.get(key)
      if (cached !== undefined) return cached
      const column = columns[first ? 0 : 1]!
      const source = sources[first ? 0 : 1]!.get(block.id)
      if (!source) throw new Error('Не найден блок резюме')
      const clone = source.cloneNode(true) as HTMLElement
      const text = clone.querySelector('.block-text, h2, h3')
      if (text) text.innerHTML = textHtml(block.text)
      if (!block.label) clone.querySelector('strong')?.remove()
      if (!block.href) clone.querySelector('a')?.remove()
      column.append(clone)
      // Blocks use internal padding instead of collapsing margins.
      const height = clone.getBoundingClientRect().height
      clone.remove()
      cache.set(key, height)
      return height
    }
    pages.value = paginate(blocks.value, first => capacities[first ? 0 : 1]!, measure)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось сформировать страницы'
  } finally {
    if (run === generation) busy.value = false
  }
}

function printResume() { window.print() }

onMounted(() => {
  void store.initializeHistory()
  resizeObserver = new ResizeObserver(entries => { stageWidth.value = entries[0]!.contentRect.width })
  if (stage.value) resizeObserver.observe(stage.value)
  void layout()
})
watch(blocks, () => { void layout() }, { deep: true })
onBeforeUnmount(() => { disposed = true; generation++; resizeObserver?.disconnect() })
</script>

<template>
  <div class="workspace">
    <header class="app-header screen-only">
      <a class="brand" href="#" aria-label="Резюме — на главную"><span class="brand-icon">р.</span>Резюме<span class="brand-divider">/</span><span class="brand-caption">Моё рабочее пространство</span></a>
    </header>

    <div class="workspace-body">
      <ResumeHistory
        :versions="history"
        :active-id="activeVersion.id"
        :error="historyError"
        @select="selectVersion"
      />
      <main class="document-workspace">
        <div class="viewer-toolbar screen-only" aria-label="Панель просмотра">
          <div class="document-meta"><span class="file-symbol" aria-hidden="true">▤</span><div><strong>{{ resume.profile.name }}</strong><span aria-live="polite">{{ busy ? 'Формируем страницы…' : `${pages.length} стр. · A4` }}</span></div></div>
          <div class="viewer-actions">
            <label class="design-control">
              <span>Дизайн</span>
              <select v-model="design" aria-label="Дизайн резюме">
                <option value="two-column">Две колонки</option>
                <option value="single-column">Одна колонка</option>
              </select>
            </label>
            <label class="zoom-control"><span class="sr-only">Масштаб документа</span><select v-model="zoom"><option value="fit">По ширине</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option></select></label>
            <button v-if="!viewingLatest" class="resume-control" type="button" :disabled="!historyReady || restoringVersion" @click="restoreVersion">
              Восстановить
            </button>
            <button class="resume-control" type="button" :disabled="!historyReady || restoringVersion" @click="openEditor">Редактировать</button>
            <button class="print-button" type="button" :disabled="busy || !!error" @click="printResume"><span aria-hidden="true">↥</span>Печать / PDF</button>
          </div>
        </div>

        <p v-if="versionActionError" class="resume-editor-error screen-only" role="alert">{{ versionActionError }}</p>
        <div ref="stage" class="document-stage" :aria-busy="busy">
          <p v-if="error" role="alert" class="layout-error screen-only">{{ error }}</p>
          <div v-for="(page, index) in pages" :id="`sheet-${index}`" :key="index" class="sheet-wrapper" :style="pageStyle">
            <div class="scaled-sheet" :style="{ transform: `scale(${scale})` }">
              <ResumePage :page="page" :profile="resume.profile" :number="index + 1" :total="pages.length" :design="design" />
            </div>
          </div>
          <p v-if="pages.length" class="end-note screen-only">Конец документа · {{ pages.length }} стр.</p>
        </div>
      </main>
    </div>

    <ResumeEditor
      v-if="editorOpen"
      :resume="resume"
      :version-label="activeVersion.title"
      :error="editorError"
      :saving="savingVersion"
      @close="editorOpen = false"
      @save="saveVersion"
    />

    <!-- Real-size copies are independent of screen zoom and viewport width. -->
    <div class="measurement-root" aria-hidden="true" inert>
      <article ref="firstMeasure" class="resume-page" :class="`design-${design}`">
        <ResumeHeader :profile="resume.profile" :design="design" />
        <div class="page-layout" :class="{ 'page-layout-first': design === 'two-column' }"><div v-if="design === 'two-column'"></div><div class="page-main"><ResumeBlock v-for="block in blocks" :key="block.id" :block="block" /></div></div>
        <footer class="resume-page-footer"></footer>
      </article>
      <article ref="nextMeasure" class="resume-page" :class="`design-${design}`">
        <div class="continuation-header"><span>{{ resume.profile.name }}</span><span>{{ plainText(resume.profile.role) }}</span></div>
        <div class="page-layout"><div class="page-main"><ResumeBlock v-for="block in blocks" :key="block.id" :block="block" /></div></div>
        <footer class="resume-page-footer"></footer>
      </article>
    </div>
  </div>
</template>
