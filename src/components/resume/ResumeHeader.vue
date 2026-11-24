<script setup lang="ts">
import type { Resume } from '../../types/resume'
defineProps<{ profile: Resume['profile'] }>()
</script>

<template>
  <header class="resume-header">
    <p class="resume-eyebrow">Резюме</p>
    <h1>{{ profile.name }}</h1>
    <div class="resume-header-bottom">
      <p>{{ profile.role }}</p>
      <p class="resume-salary">{{ profile.salary }}</p>
    </div>
  </header>
</template>
