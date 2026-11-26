<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Resume } from '../types/resume'
import RichTextField from './RichTextField.vue'
import { blankJob } from '../utils/resumeSources'
import { editableWorkDescription, replaceWorkDescription } from '../utils/workDescription'
import { joinText, plainText } from '../utils/richText'

const props = defineProps<{ resume: Resume; versionLabel: string; error: string; saving: boolean; creatingSource?: boolean }>()
const emit = defineEmits<{ save: [resume: Resume, label: string]; close: [] }>()

const draft = ref<Resume>(JSON.parse(JSON.stringify(props.resume)))
const personalFields = computed(() =>
  draft.value.sections.find(section => section.id === 'personal')?.entries.flatMap(entry => entry.fields ?? []) ?? [],
)
const experience = computed(() => draft.value.sections.find(section => section.id === 'experience'))
const education = computed(() => draft.value.sections.find(section => section.id === 'education')?.entries ?? [])
const projects = ref(
  draft.value.sections.find(section => section.id === 'pet-projects')?.entries ?? [],
)

function addProject() {
  projects.value.push({
    id: `pet-project-${crypto.randomUUID()}`,
    title: '',
    description: '',
  })
}
const jobs = ref((experience.value?.entries ?? [])
  .filter(entry => entry.id === 'it-service' || entry.subtitle || entry.position !== undefined || entry.period !== undefined)
  .map(entry => {
    const [position = '', ...period] = (entry.subtitle ?? '').split(' · ')
    return {
      entry, position: entry.position ?? position, period: entry.period ?? period.join(' · '),
      description: editableWorkDescription(entry),
    }
  }))


function addJob() {
  const entry = blankJob('job-' + crypto.randomUUID())
  experience.value?.entries.push(entry)
  jobs.value.push({ entry, position: '', period: '', description: '' })
}

function removeJob(index: number) {
  const job = jobs.value[index]
  if (!job || !experience.value) return
  experience.value.entries = experience.value.entries.filter(entry => entry.id !== job.entry.id)
  jobs.value.splice(index, 1)
}

const sections = { hard: 'section-3', soft: 'section-4', courses: 'section-5', about: 'section-6' }
const courseFields = ['Проводившая организация', 'Год окончания', 'Специальность', 'Формат']

function sectionText(id: string) {
  return computed({
    get() {
      const section = draft.value.sections.find(item => item.id === id)
      if (section?.text !== undefined) return section.text
      return joinText((section?.entries ?? []).map(entry => joinText([
        entry.title ?? '',
        entry.subtitle ?? '',
        ...(entry.fields ?? []).map(field => joinText([field.label, field.value], ': ')),
        ...(entry.paragraphs ?? []),
        ...(entry.items ?? []).map(item => item.text),
      ].filter(Boolean), '\n')), '\n\n')
    },
    set(text: string) {
      const section = draft.value.sections.find(item => item.id === id)
      if (section) section.text = text
    },
  })
}
const hardSkills = sectionText(sections.hard)
const softSkills = sectionText(sections.soft)
const about = sectionText(sections.about)
const courses = computed(() => draft.value.sections.find(section => section.id === sections.courses)?.entries ?? [])

function addCourse() {
  const section = draft.value.sections.find(item => item.id === sections.courses)
  section?.entries.push({
    id: 'course-' + crypto.randomUUID(),
    title: '',
    fields: courseFields.map(label => ({ label, value: '' })),
  })
}

const formError = ref('')
function submit() {
  if (props.creatingSource && !label.value.trim()) {
    formError.value = 'Укажи название резюме для списка.'
    return
  }
  if (!plainText(draft.value.profile.role).trim()) {
    formError.value = 'Укажи название вакансии.'
    return
  }
  if (courses.value.some(course => !plainText(course.title ?? '').trim())) {
    formError.value = 'Укажи название каждого курса.'
    return
  }
  formError.value = ''
  emit('save', snapshot(), label.value)
}

const label = ref('')
const dialog = ref<HTMLDialogElement>()
const confirmClose = ref(false)

function snapshot(): Resume {
  const resume: Resume = JSON.parse(JSON.stringify(draft.value))
  const entries = resume.sections.find(section => section.id === 'experience')?.entries ?? []
  for (const job of jobs.value) {
    const entry = entries.find(item => item.id === job.entry.id)
    if (!entry) continue
    replaceWorkDescription(entry, job.description)
    const [oldPosition = '', ...oldPeriod] = (entry.subtitle ?? '').split(' · ')
    if (job.position !== (entry.position ?? oldPosition) || job.period !== (entry.period ?? oldPeriod.join(' · '))) {
      entry.position = job.position
      entry.period = job.period
    }
  }
    const projectEntries = projects.value
    .filter(project =>
      plainText(project.title ?? '').trim() ||
      plainText(project.description ?? '').trim(),
    )
    .map(project => ({
      id: project.id,
      title: project.title ?? '',
      description: project.description ?? '',
    }))

  resume.sections = resume.sections.filter(section => section.id !== 'pet-projects')

  if (projectEntries.length) {
    const experienceIndex = resume.sections.findIndex(section => section.id === 'experience')
    const educationIndex = resume.sections.findIndex(section => section.id === 'education')
    const insertAt = experienceIndex >= 0
      ? experienceIndex + 1
      : educationIndex >= 0 ? educationIndex : resume.sections.length

    resume.sections.splice(insertAt, 0, {
      id: 'pet-projects',
      title: 'Пет-проекты',
      entries: projectEntries,
    })
  }
  return resume
}

const initial = JSON.stringify(snapshot())
const dirty = computed(() => JSON.stringify(snapshot()) !== initial || !!(props.creatingSource && label.value.trim()))

function close() {
  if (props.saving) return
  if (dirty.value) confirmClose.value = true
  else emit('close')
}

function revealInvalidField(event: Event) {
  const details = (event.target as HTMLElement).closest('details')
  if (details) details.open = true
}

onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="resume-editor screen-only" aria-labelledby="resume-editor-title" @cancel.prevent="close">
    <form class="resume-editor-form" @invalid.capture="revealInvalidField" @submit.prevent="submit">
      <header class="resume-editor-header">
        <div>
          <h2 id="resume-editor-title">{{ creatingSource ? 'Новое исходное резюме' : 'Редактирование резюме' }}</h2>
          <p v-if="!creatingSource">{{ versionLabel }}</p>
        </div>
        <button type="button" class="resume-control" aria-label="Закрыть редактор" :disabled="saving" @click="close">×</button>
      </header>

      <fieldset class="resume-editor-fields" :disabled="saving">
        <label v-if="creatingSource">Название резюме в списке <input v-model.trim="label" maxlength="100" required placeholder="Например, Frontend-разработчик"></label>
        <details open>
          <summary>Вакансия и зарплата</summary>
          <label>Имя и фамилия <input v-model="draft.profile.name"></label>
          <label>Фото (имя файла из public или ссылка) <input v-model.trim="draft.profile.photo"></label>
          <RichTextField v-model="draft.profile.role" label="Название вакансии" :disabled="saving" />
          <RichTextField v-model="draft.profile.salary" label="Зарплата" :disabled="saving" />
        </details>

        <details>
          <summary>Контакты</summary>
          <fieldset v-for="(contact, index) in draft.profile.contacts" :key="index">
            <legend>{{ plainText(contact.label) || 'Контакт' }}</legend>
            <RichTextField v-model="contact.label" label="Название" :disabled="saving" />
            <RichTextField v-model="contact.value" label="Значение" :disabled="saving" />
            <label>Ссылка <input v-model.trim="contact.href" placeholder="https://, mailto: или tel:"></label>
          </fieldset>
        </details>

        <details>
          <summary>Условия работы и основной стек</summary>
          <div v-for="(field, index) in draft.profile.preferences" :key="index" class="resume-editor-item">
            <RichTextField v-model="field.label" label="Название пункта" :disabled="saving" />
            <RichTextField v-model="field.value" label="Значение" :disabled="saving" />
            <button type="button" @click="draft.profile.preferences.splice(index, 1)">Удалить пункт</button>
          </div>
          <button type="button" @click="draft.profile.preferences.push({ label: '', value: '' })">Добавить пункт</button>

          <fieldset v-if="draft.profile.tags.length">
            <legend>Основной стек</legend>
            <div v-for="(_, index) in draft.profile.tags" :key="index" class="resume-editor-row">
              <RichTextField v-model="draft.profile.tags[index]" :label="`Навык ${index + 1}`" :disabled="saving" />
              <button type="button" @click="draft.profile.tags.splice(index, 1)">Удалить навык</button>
            </div>
            <div class="resume-editor-row">
              <button type="button" @click="draft.profile.tags.push('')">Добавить навык</button>
              <button type="button" @click="draft.profile.tags = []">Удалить основной стек</button>
            </div>
          </fieldset>
          <button v-else type="button" @click="draft.profile.tags.push('')">Добавить основной стек</button>
        </details>

        <details v-if="personalFields.length">
          <summary>Личная информация</summary>
          <RichTextField v-for="(field, index) in personalFields" :key="index"
            v-model="field.value" :label="plainText(field.label)" :disabled="saving" />
        </details>

        <details v-if="experience">
          <summary>Опыт работы</summary>
          <fieldset v-for="(job, index) in jobs" :key="job.entry.id">
            <legend>{{ plainText(job.entry.title ?? '') || 'Место работы' }}</legend>
            <RichTextField v-model="job.entry.title" label="Название компании" :disabled="saving" />
            <RichTextField v-model="job.position" label="Должность" :disabled="saving" />
            <RichTextField v-model="job.period" label="Период работы" :disabled="saving" />
            <RichTextField v-model="job.description" label="Описание работы" multiline :disabled="saving" />
            <button type="button" @click="removeJob(index)">Удалить место работы</button>
          </fieldset>
          <button type="button" @click="addJob">Добавить место работы</button>
        </details>

                <details>
          <summary>Пет-проекты</summary>
          <fieldset v-for="(project, index) in projects" :key="project.id">
            <legend>{{ plainText(project.title ?? '') || 'Новый проект' }}</legend>
            <RichTextField
              v-model="project.title"
              label="Название проекта"
              :disabled="saving"
            />
            <RichTextField
              v-model="project.description"
              label="Описание проекта"
              multiline
              :disabled="saving"
            />
            <button type="button" @click="projects.splice(index, 1)">
              Удалить проект
            </button>
          </fieldset>
          <button type="button" @click="addProject">Добавить проект</button>
        </details>

        <details v-if="education.length">
          <summary>Образование</summary>
          <fieldset v-for="entry in education" :key="entry.id">
            <legend>Учебное заведение</legend>
            <RichTextField v-model="entry.title" label="Название" :disabled="saving" />
            <RichTextField v-for="(field, index) in entry.fields" :key="index"
              v-model="field.value" :label="field.label" :disabled="saving" />
          </fieldset>
        </details>
        <details>
          <summary>Hard Skills</summary>
          <RichTextField v-model="hardSkills" label="Hard Skills" multiline :disabled="saving" />
        </details>
        <details>
          <summary>Soft Skills</summary>
          <RichTextField v-model="softSkills" label="Soft Skills" multiline :disabled="saving" />
        </details>
        <details>
          <summary>Курсы и тренинги</summary>
          <fieldset v-for="(course, index) in courses" :key="course.id">
            <legend>{{ plainText(course.title ?? '') || 'Новый курс' }}</legend>
            <RichTextField v-model="course.title" label="Название курса" :disabled="saving" />
            <RichTextField v-for="(field, fieldIndex) in course.fields" :key="fieldIndex"
              v-model="field.value" :label="field.label" :disabled="saving" />
            <button type="button" @click="courses.splice(index, 1)">Удалить курс</button>
          </fieldset>
          <button type="button" @click="addCourse">Добавить курс</button>
        </details>
        <details>
          <summary>О себе</summary>
          <RichTextField v-model="about" label="О себе" multiline :disabled="saving" />
        </details>
        <label v-if="!creatingSource">Название новой версии <input v-model="label" placeholder="Например, для вакансии Vue-разработчика"></label>
      </fieldset>

      <footer class="resume-editor-actions">
        <template v-if="confirmClose">
          <p>Закрыть редактор без сохранения правок?</p>
          <button type="button" class="resume-control" @click="confirmClose = false">Продолжить редактирование</button>
          <button type="button" class="resume-control" @click="emit('close')">Закрыть без сохранения</button>
        </template>
        <template v-else>
          <p v-if="formError || error" role="alert" class="resume-editor-error">{{ formError || error }}</p>
          <button type="button" class="resume-control" :disabled="saving" @click="close">Отмена</button>
          <button type="submit" class="print-button" :disabled="saving || !dirty">{{ saving ? 'Сохраняем…' : creatingSource ? 'Создать резюме' : 'Сохранить версию' }}</button>
        </template>
      </footer>
    </form>
  </dialog>
</template>
