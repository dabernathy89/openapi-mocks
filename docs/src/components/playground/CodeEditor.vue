<script setup lang="ts">
import { Codemirror } from 'vue-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const extensions = [javascript(), oneDark, EditorView.lineWrapping];

function handleChange(value: string) {
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="code-editor">
    <div class="panel-header">
      <span class="panel-label">Client Code</span>
      <span class="panel-note">// createMockClient and spec are pre-injected</span>
    </div>
    <div class="editor-wrap">
      <Codemirror
        :model-value="props.modelValue"
        :extensions="extensions"
        @update:model-value="handleChange"
      />
    </div>
  </div>
</template>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #21252b;
  border-bottom: 1px solid #3e4451;
  flex-shrink: 0;
}

.panel-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: #abb2bf;
}

.panel-note {
  font-size: 0.75rem;
  color: #5c6370;
  font-family: monospace;
}

.editor-wrap {
  flex: 1;
  overflow: auto;
}

.editor-wrap :deep(.cm-editor) {
  height: 100%;
}

.editor-wrap :deep(.cm-scroller) {
  overflow: auto;
}
</style>
