<script setup lang="ts">
import { plainText } from '../../utils/richText'
import type { Resume, ResumeDesign, ResumePage } from '../../types/resume'
import ResumeHeader from './ResumeHeader.vue'
import ResumeSidebar from './ResumeSidebar.vue'
import ResumeBlock from './ResumeBlock.vue'
defineProps<{ page: ResumePage; profile: Resume['profile']; number: number; total: number; design: ResumeDesign }>()
</script>

<template>
  <article class="resume-page" :class="`design-${design}`" :aria-label="`Страница ${number} из ${total}`">
    <ResumeHeader v-if="number === 1" :profile="profile" :design="design" />
    <div v-else class="continuation-header"><span>{{ profile.name }}</span><span>{{ plainText(profile.role) }}</span></div>
    <div class="page-layout" :class="{ 'page-layout-first': number === 1 && design === 'two-column' }">
      <ResumeSidebar v-if="number === 1 && design === 'two-column'" :profile="profile" />
      <div class="page-main">
        <ResumeBlock v-for="block in page.blocks" :key="block.id" :block="block" />
      </div>
    </div>
    <footer class="resume-page-footer"><span>{{ plainText(profile.role) }}</span><span>{{ number }} / {{ total }}</span></footer>
  </article>
</template>
