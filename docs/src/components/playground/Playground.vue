<script setup lang="ts">
import SpecEditor from './SpecEditor.vue';
import CodeEditor from './CodeEditor.vue';
import HandlerAccordion from './HandlerAccordion.vue';
import { ref } from 'vue';

const specText = ref('');
const codeText = ref('');
const routes = ref([]);
</script>

<template>
  <div class="playground">
    <SpecEditor v-model="specText" />
    <CodeEditor v-model="codeText" />
    <HandlerAccordion :routes="routes" />
  </div>
</template>
