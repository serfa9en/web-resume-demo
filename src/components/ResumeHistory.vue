<script setup lang="ts">
import type { ResumeVersion } from '../stores/resume'

defineProps<{ versions: ResumeVersion[]; activeId: string; error: string }>()
defineEmits<{ select: [id: string] }>()

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Yekaterinburg' })
</script>

<template>
  <aside class="resume-history screen-only" aria-label="История версий">
    <h2>История версий</h2>
    <p v-if="error" class="resume-editor-error" role="alert">{{ error }}</p>
    <ol>
      <li v-for="(version, index) in versions" :key="version.id">
        <button
          type="button"
          :aria-current="version.id === activeId ? 'true' : undefined"
          @click="$emit('select', version.id)"
        >
          <strong>{{ version.title }}</strong>
          <time v-if="version.createdAt" :datetime="version.createdAt">
            {{ dateFormat.format(new Date(version.createdAt)) }}
          </time>
          <span v-if="index === 0">Последняя версия</span>
        </button>
      </li>
    </ol>
  </aside>
</template>
