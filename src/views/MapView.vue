<script setup lang="ts">
import { computed, ref } from 'vue'
import MapCanvas from '../components/MapCanvas.vue'
import ObjectSidebar from '../components/ObjectSidebar.vue'
import { useMapStore } from '../stores/map'

const store = useMapStore()
const mapRef = ref<InstanceType<typeof MapCanvas> | null>(null)
const selectedMarker = computed(() => store.markers.find((marker) => marker.id === store.selectedId) ?? null)

function focusMarker(id: number) {
  store.select(id)
  mapRef.value?.focusMarker(id)
}

function resetMap() {
  store.restore()
  requestAnimationFrame(() => mapRef.value?.fitAll())
}
</script>

<template>
  <main class="app-shell">
    <section class="map-panel">
      <div class="brand-badge">
        <div class="brand-mark">LO</div>
        <div>
          <strong>Linked Object Map</strong>
          <span>OpenStreetMap · интерактивная карта</span>
        </div>
      </div>
      <MapCanvas ref="mapRef" :selected-marker="selectedMarker" @select="store.select" />
      <div v-if="store.visibleMarkers.length === 0" class="empty-map">
        <span class="empty-map__icon">⌖</span>
        <strong>Карта очищена</strong>
        <span>Нажмите «Поиск», чтобы вернуть объекты</span>
      </div>
    </section>

    <ObjectSidebar @focus="focusMarker" @reset-map="resetMap" />
  </main>
</template>
