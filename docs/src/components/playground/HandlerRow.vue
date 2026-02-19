<script setup lang="ts">
import type { HandlerInfo } from './types';

defineProps<{ route: HandlerInfo }>();
</script>

<template>
  <div class="handler-row">
    <span class="method">{{ route.method }}</span>
    <span class="path">{{ route.path }}</span>
  </div>
</template>
