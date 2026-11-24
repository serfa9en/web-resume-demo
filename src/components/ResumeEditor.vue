<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Resume } from '../types/resume'

const props = defineProps<{ resume: Resume; versionLabel: string; error: string; saving: boolean }>()
const emit = defineEmits<{ save: [resume: Resume, label: string]; close: [] }>()

const draft = ref<Resume>(JSON.parse(JSON.stringify(props.resume)))
const personalFields = computed(() =>
  draft.value.sections.find(section => section.id === 'personal')?.entries.flatMap(entry => entry.fields ?? []) ?? [],
)
const jobs = ref((draft.value.sections.find(section => section.id === 'experience')?.entries ?? [])
  .filter(entry => entry.id === 'it-service' || entry.subtitle || entry.position !== undefined || entry.period !== undefined)
  .map(entry => {
    const [position = '', ...period] = (entry.subtitle ?? '').split(' · ')
    return { entry, position: entry.position ?? position, period: entry.period ?? period.join(' · ') }
  }))

const label = ref('')
const dialog = ref<HTMLDialogElement>()
const confirmClose = ref(false)

function snapshot(): Resume {
  const resume: Resume = JSON.parse(JSON.stringify(draft.value))
  const entries = resume.sections.find(section => section.id === 'experience')?.entries ?? []
  for (const job of jobs.value) {
    const entry = entries.find(item => item.id === job.entry.id)
    if (!entry) continue
    const [oldPosition = '', ...oldPeriod] = (entry.subtitle ?? '').split(' · ')
    if (job.position !== (entry.position ?? oldPosition) || job.period !== (entry.period ?? oldPeriod.join(' · '))) {
      entry.position = job.position
      entry.period = job.period
    }
  }
  return resume
}

const initial = JSON.stringify(snapshot())
const dirty = computed(() => JSON.stringify(snapshot()) !== initial)

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
    <form class="resume-editor-form" @invalid.capture="revealInvalidField" @submit.prevent="emit('save', snapshot(), label)">
      <header class="resume-editor-header">
        <div>
          <h2 id="resume-editor-title">Редактирование резюме</h2>
          <p>{{ versionLabel }}</p>
        </div>
        <button type="button" class="resume-control" aria-label="Закрыть редактор" :disabled="saving" @click="close">×</button>
      </header>

      <fieldset class="resume-editor-fields" :disabled="saving">
        <details open>
          <summary>Вакансия и зарплата</summary>
          <label>Название вакансии <input v-model.trim="draft.profile.role" required></label>
          <label>Зарплата <input v-model="draft.profile.salary"></label>
        </details>

        <details>
          <summary>Контакты</summary>
          <fieldset v-for="(contact, index) in draft.profile.contacts" :key="index">
            <legend>{{ contact.label || 'Контакт' }}</legend>
            <label>Название <input v-model="contact.label" required></label>
            <label>Значение <input v-model="contact.value" required></label>
            <label>Ссылка <input v-model.trim="contact.href" placeholder="https://, mailto: или tel:"></label>
          </fieldset>
        </details>

        <details>
          <summary>Условия работы и основной стек</summary>
          <div v-for="(field, index) in draft.profile.preferences" :key="index" class="resume-editor-item">
            <label>Название пункта <input v-model.trim="field.label" required></label>
            <label>Значение <input v-model="field.value"></label>
            <button type="button" @click="draft.profile.preferences.splice(index, 1)">Удалить пункт</button>
          </div>
          <button type="button" @click="draft.profile.preferences.push({ label: '', value: '' })">Добавить пункт</button>

          <fieldset v-if="draft.profile.tags.length">
            <legend>Основной стек</legend>
            <div v-for="(_, index) in draft.profile.tags" :key="index" class="resume-editor-row">
              <input v-model.trim="draft.profile.tags[index]" :aria-label="`Навык ${index + 1}`" required>
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
          <label v-for="(field, index) in personalFields" :key="index">
            {{ field.label }}
            <input v-model="field.value">
          </label>
        </details>

        <details v-if="jobs.length">
          <summary>Опыт работы</summary>
          <fieldset v-for="job in jobs" :key="job.entry.id">
            <legend>{{ job.entry.title || 'Место работы' }}</legend>
            <label>Название компании <input v-model="job.entry.title"></label>
            <label>Должность <input v-model="job.position"></label>
            <label>Период работы <input v-model="job.period" placeholder="Например, май 2022 — настоящее время"></label>
            <label>Описание работы <textarea v-model="job.entry.description" rows="5"></textarea></label>
          </fieldset>
        </details>

        <label>Название новой версии <input v-model="label" placeholder="Например, для вакансии Vue-разработчика"></label>
      </fieldset>

      <footer class="resume-editor-actions">
        <template v-if="confirmClose">
          <p>Закрыть редактор без сохранения правок?</p>
          <button type="button" class="resume-control" @click="confirmClose = false">Продолжить редактирование</button>
          <button type="button" class="resume-control" @click="emit('close')">Закрыть без сохранения</button>
        </template>
        <template v-else>
          <p v-if="error" role="alert" class="resume-editor-error">{{ error }}</p>
          <button type="button" class="resume-control" :disabled="saving" @click="close">Отмена</button>
          <button type="submit" class="print-button" :disabled="saving || !dirty">{{ saving ? 'Сохраняем…' : 'Сохранить версию' }}</button>
        </template>
      </footer>
    </form>
  </dialog>
</template>
