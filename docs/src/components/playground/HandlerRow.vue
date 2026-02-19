<script setup lang="ts">
import type { HandlerInfo } from './types';

const props = defineProps<{
  route: HandlerInfo;
  expanded: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

function methodClass(method: string) {
  const m = method.toUpperCase();
  return `method-badge method-${m}`;
}
</script>

<template>
  <div class="handler-row">
    <button
      class="row-header"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <span :class="methodClass(route.method)">{{ route.method.toUpperCase() }}</span>
      <span class="path">{{ route.path }}</span>
      <span class="chevron" :class="{ open: expanded }">▶</span>
    </button>
  </div>
</template>

<style scoped>
.handler-row {
  border-bottom: 1px solid var(--sl-color-gray-6, #333);
}

.row-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-family: var(--sl-font-mono, monospace);
  font-size: 0.8125rem;
}

.row-header:hover {
  background: var(--sl-color-gray-7, #1e1e1e);
}

.method-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  min-width: 4rem;
  text-align: center;
  flex-shrink: 0;
}

.method-GET    { background: #166534; color: #86efac; }
.method-POST   { background: #1e3a5f; color: #93c5fd; }
.method-PUT    { background: #713f12; color: #fde68a; }
.method-PATCH  { background: #581c87; color: #d8b4fe; }
.method-DELETE { background: #7f1d1d; color: #fca5a5; }
.method-HEAD   { background: #164e63; color: #67e8f9; }
.method-OPTIONS{ background: #374151; color: #d1d5db; }

.path {
  flex: 1;
  color: var(--sl-color-white, #e5e7eb);
}

.chevron {
  font-size: 0.625rem;
  color: var(--sl-color-gray-3, #888);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(90deg);
}
</style>
