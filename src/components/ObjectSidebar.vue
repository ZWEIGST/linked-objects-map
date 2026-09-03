<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '../stores/map'

const emit = defineEmits<{ focus: [id: number]; resetMap: [] }>()
const store = useMapStore()
const visibleCount = computed(() => store.visibleMarkers.length)

function handleCardClick(id: number) {
  if (!store.visibleIds.has(id)) return
  emit('focus', id)
}

function handleToggle(event: Event, id: number) {
  event.stopPropagation()
  store.toggleMarker(id)
}
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar__header">
      <div>
        <p class="eyebrow">Объекты</p>
        <h1>Linked Object Map</h1>
        <p class="sidebar__meta">{{ visibleCount }} из {{ store.markers.length }} объектов на карте</p>
      </div>
      <div class="header-counter">{{ visibleCount }}</div>
    </header>

    <section class="controls">
      <button class="control-button control-button--ghost" type="button" @click="store.clear">
        <span>×</span> Очистить
      </button>
      <button class="control-button control-button--primary" type="button" @click="emit('resetMap')">
        <span>↻</span> Поиск
      </button>
    </section>

    <div v-if="store.isReady" class="cards" aria-label="Список объектов">
      <button
        v-for="marker in store.markers"
        :key="marker.id"
        class="object-card"
        :class="{ 'object-card--hidden': !store.visibleIds.has(marker.id) }"
        type="button"
        @click="handleCardClick(marker.id)"
      >
        <span class="object-card__color" :style="{ backgroundColor: store.colorForTitle(marker.title) }" />
        <span class="object-card__content">
          <span class="object-card__title">{{ marker.title }}</span>
          <span class="object-card__description">{{ marker.description }}</span>
        </span>
        <input
          class="object-card__checkbox"
          type="checkbox"
          :checked="store.visibleIds.has(marker.id)"
          :aria-label="`Показать ${marker.title}`"
          @click="handleToggle($event, marker.id)"
        />
      </button>
    </div>

    <div v-else class="sidebar-empty">
      <div class="sidebar-empty__icon">○</div>
      <strong>Список очищен</strong>
      <span>Все маркеры и карточки скрыты.</span>
      <button type="button" @click="emit('resetMap')">Вернуть объекты</button>
    </div>
  </aside>
</template>
