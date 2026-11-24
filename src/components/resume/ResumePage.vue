<script setup lang="ts">
import type { Resume, ResumePage } from '../../types/resume'
import ResumeHeader from './ResumeHeader.vue'
import ResumeSidebar from './ResumeSidebar.vue'
import ResumeBlock from './ResumeBlock.vue'
defineProps<{ page: ResumePage; profile: Resume['profile']; number: number; total: number }>()
</script>

<template>
  <article class="resume-page" :aria-label="`Страница ${number} из ${total}`">
    <ResumeHeader v-if="number === 1" :profile="profile" />
    <div v-else class="continuation-header"><span>{{ profile.name }}</span><span>{{ profile.role }}</span></div>
    <div class="page-layout" :class="{ 'page-layout-first': number === 1 }">
      <ResumeSidebar v-if="number === 1" :profile="profile" />
      <div class="page-main">
        <ResumeBlock v-for="block in page.blocks" :key="block.id" :block="block" />
      </div>
    </div>
    <footer class="resume-page-footer"><span>{{ profile.role }}</span><span>{{ number }} / {{ total }}</span></footer>
  </article>
</template>
