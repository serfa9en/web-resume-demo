<script setup lang="ts">
import type { DocumentBlock } from '../../types/resume'
defineProps<{ block: DocumentBlock }>()
</script>

<template>
  <div class="resume-block" :class="[`block-${block.kind}`, { 'is-achievement': block.achievement }]"
    :style="block.depth ? { paddingLeft: `${block.depth * 4 + 4}mm` } : undefined">
    <h2 v-if="block.kind === 'section'">{{ block.text }}</h2>
    <h3 v-else-if="block.kind === 'entry'">{{ block.text }}</h3>
    <p v-else>
      <span v-if="block.kind === 'bullet'" class="bullet-marker" aria-hidden="true">{{ block.achievement ? '✓' : '•' }}</span>
      <strong v-if="block.label">{{ block.label }}: </strong>
      <span class="block-text">{{ block.text }}</span>
      <a v-if="block.href" :href="block.href" class="block-link">
        {{ block.kind === 'bullet' ? 'Репозиторий ↗' : 'Открыть ↗' }}
      </a>
    </p>
  </div>
</template>
