<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MapMarker } from '../types'
import { useMapStore } from '../stores/map'

const props = defineProps<{ selectedMarker: MapMarker | null }>()
const emit = defineEmits<{ select: [id: number | null] }>()
const store = useMapStore()

const mapEl = ref<HTMLDivElement | null>(null)
const viewportEl = ref<HTMLDivElement | null>(null)
const zoom = ref(7)
const center = ref<[number, number]>([55.75, 37.62])
const tileUrls = ref<string[]>([])
const mapSize = ref({ width: 0, height: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const startCenterPixel = ref({ x: 0, y: 0 })
const popupOffset = ref({ x: 0, y: 0 })
const TILE_SIZE = 256
const MIN_ZOOM = 3
const MAX_ZOOM = 15

const visibleMarkers = computed(() => store.visibleMarkers)
const selectedPoint = computed(() => {
  if (!props.selectedMarker) return null
  return project(props.selectedMarker.latitude, props.selectedMarker.longitude)
})

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function worldSize(z = zoom.value) { return TILE_SIZE * 2 ** z }
function project(lat: number, lon: number, z = zoom.value) {
  const size = worldSize(z)
  const x = ((lon + 180) / 360) * size
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size
  return { x, y }
}
function unproject(x: number, y: number, z = zoom.value): [number, number] {
  const size = worldSize(z)
  const lon = (x / size) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return [lat, lon]
}
function centerPixel() { return project(center.value[0], center.value[1]) }
function screenPoint(lat: number, lon: number) {
  const p = project(lat, lon)
  const c = centerPixel()
  const size = worldSize()
  let dx = p.x - c.x
  if (dx > size / 2) dx -= size
  if (dx < -size / 2) dx += size
  return { x: mapSize.value.width / 2 + dx, y: mapSize.value.height / 2 + p.y - c.y }
}
function tileXY(x: number, y: number, z: number) {
  const n = 2 ** z
  const tx = ((x % n) + n) % n
  return { x: tx, y: clamp(y, 0, n - 1) }
}
function rebuildTiles() {
  if (!mapEl.value) return
  const size = worldSize()
  const c = centerPixel()
  const cols = Math.ceil(mapSize.value.width / TILE_SIZE) + 3
  const rows = Math.ceil(mapSize.value.height / TILE_SIZE) + 3
  const startX = Math.floor((c.x - mapSize.value.width / 2) / TILE_SIZE) - 1
  const startY = Math.floor((c.y - mapSize.value.height / 2) / TILE_SIZE) - 1
  const urls: string[] = []
  for (let y = startY; y < startY + rows; y++) {
    for (let x = startX; x < startX + cols; x++) {
      const t = tileXY(x, y, zoom.value)
      urls.push(`https://tile.openstreetmap.org/${zoom.value}/${t.x}/${t.y}.png`)
    }
  }
  tileUrls.value = urls
  void size
}
function tileStyle(index: number) {
  if (!mapSize.value.width) return {}
  const cols = Math.ceil(mapSize.value.width / TILE_SIZE) + 3
  const c = centerPixel()
  const startX = Math.floor((c.x - mapSize.value.width / 2) / TILE_SIZE) - 1
  const startY = Math.floor((c.y - mapSize.value.height / 2) / TILE_SIZE) - 1
  const x = startX + (index % cols)
  const y = startY + Math.floor(index / cols)
  const t = tileXY(x, y, zoom.value)
  const size = worldSize()
  let dx = x * TILE_SIZE - c.x + mapSize.value.width / 2
  if (dx < -TILE_SIZE) dx += size
  if (dx > size - TILE_SIZE) dx -= size
  return { transform: `translate(${dx}px, ${y * TILE_SIZE - c.y + mapSize.value.height / 2}px)` }
}
function resize() {
  if (!mapEl.value) return
  mapSize.value = { width: mapEl.value.clientWidth, height: mapEl.value.clientHeight }
  rebuildTiles()
}
function onPointerDown(event: PointerEvent) {
  if (!mapEl.value) return
  isDragging.value = true
  mapEl.value.setPointerCapture(event.pointerId)
  dragStart.value = { x: event.clientX, y: event.clientY }
  startCenterPixel.value = centerPixel()
}
function onPointerMove(event: PointerEvent) {
  if (!isDragging.value) return
  const next = { x: startCenterPixel.value.x - (event.clientX - dragStart.value.x), y: startCenterPixel.value.y - (event.clientY - dragStart.value.y) }
  center.value = unproject(next.x, next.y)
  rebuildTiles()
}
function onPointerUp() { isDragging.value = false }
function onWheel(event: WheelEvent) {
  event.preventDefault()
  const direction = event.deltaY > 0 ? -1 : 1
  const nextZoom = clamp(zoom.value + direction, MIN_ZOOM, MAX_ZOOM)
  if (nextZoom === zoom.value || !mapEl.value) return
  const rect = mapEl.value.getBoundingClientRect()
  const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const before = screenToGeo(cursor.x, cursor.y)
  zoom.value = nextZoom
  const after = project(before[0], before[1])
  const newCenterPx = { x: after.x - (cursor.x - mapSize.value.width / 2), y: after.y - (cursor.y - mapSize.value.height / 2) }
  center.value = unproject(newCenterPx.x, newCenterPx.y)
  rebuildTiles()
}
function screenToGeo(x: number, y: number): [number, number] {
  const c = centerPixel()
  return unproject(c.x + x - mapSize.value.width / 2, c.y + y - mapSize.value.height / 2)
}
function markerStyle(marker: MapMarker) {
  const point = screenPoint(marker.latitude, marker.longitude)
  return { left: `${point.x}px`, top: `${point.y}px`, '--marker-color': store.colorForTitle(marker.title) }
}
function linePoints(points: [number, number][]) {
  return points.map(([lat, lon]) => { const p = screenPoint(lat, lon); return `${p.x},${p.y}` }).join(' ')
}
function focusMarker(id: number) {
  const marker = store.markers.find((item) => item.id === id)
  if (!marker) return
  center.value = [marker.latitude, marker.longitude]
  emit('select', id)
  nextTick(() => {
    popupOffset.value = { x: 0, y: 0 }
    rebuildTiles()
  })
}
function fitAll() {
  const points = store.markers.map((m) => project(m.latitude, m.longitude, 8))
  if (!points.length) return
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y))
  const pad = 80
  let targetZoom = 8
  for (let z = 12; z >= MIN_ZOOM; z--) {
    const xs = store.markers.map((m) => project(m.latitude, m.longitude, z).x)
    const ys = store.markers.map((m) => project(m.latitude, m.longitude, z).y)
    if (Math.max(...xs) - Math.min(...xs) <= mapSize.value.width - pad * 2 && Math.max(...ys) - Math.min(...ys) <= mapSize.value.height - pad * 2) { targetZoom = z; break }
  }
  zoom.value = targetZoom
  const ps = store.markers.map((m) => project(m.latitude, m.longitude, targetZoom))
  center.value = unproject((Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2, (Math.min(...ps.map((p) => p.y)) + Math.max(...ps.map((p) => p.y))) / 2, targetZoom)
  rebuildTiles()
  void minX; void maxX; void minY; void maxY
}
function markerClicked(id: number) { emit('select', id) }
function closePopup() { emit('select', null) }

watch(() => store.visibleIds, rebuildTiles, { deep: true })
onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  nextTick(fitAll)
})
onBeforeUnmount(() => window.removeEventListener('resize', resize))

defineExpose({ focusMarker, fitAll })
</script>

<template>
  <div ref="mapEl" class="map-canvas" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @wheel="onWheel">
    <div ref="viewportEl" class="tile-layer">
      <img v-for="(url, index) in tileUrls" :key="`${url}-${index}`" class="map-tile" :src="url" :style="tileStyle(index)" alt="" draggable="false" />
    </div>

    <div class="map-overlay">
      <svg class="connection-layer" :viewBox="`0 0 ${mapSize.width} ${mapSize.height}`" preserveAspectRatio="none">
        <polyline v-for="line in store.lines" :key="line.title" :points="linePoints(line.points)" fill="none" :stroke="line.color" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.78" />
      </svg>

      <button
        v-for="marker in visibleMarkers"
        :key="marker.id"
        class="map-marker"
        :class="{ 'map-marker--selected': marker.id === store.selectedId }"
        :style="markerStyle(marker)"
        type="button"
        :aria-label="marker.title"
        @click.stop="markerClicked(marker.id)"
      >
        <span class="map-marker__dot" />
        <span class="map-marker__label">{{ marker.title }}</span>
      </button>

      <div v-if="props.selectedMarker && selectedPoint" class="map-popup" :style="{ left: `${selectedPoint.x + popupOffset.x}px`, top: `${selectedPoint.y + popupOffset.y}px` }" @click.stop>
        <button class="map-popup__close" type="button" aria-label="Закрыть" @click="closePopup">×</button>
        <div class="map-popup__eyebrow">Объект #{{ props.selectedMarker.id }}</div>
        <h2>{{ props.selectedMarker.title }}</h2>
        <p>{{ props.selectedMarker.description }}</p>
        <div class="map-popup__coords">{{ props.selectedMarker.latitude.toFixed(5) }}, {{ props.selectedMarker.longitude.toFixed(5) }}</div>
      </div>
    </div>

    <div class="map-controls">
      <button type="button" aria-label="Приблизить" @click="zoom = clamp(zoom + 1, MIN_ZOOM, MAX_ZOOM); rebuildTiles()">+</button>
      <button type="button" aria-label="Отдалить" @click="zoom = clamp(zoom - 1, MIN_ZOOM, MAX_ZOOM); rebuildTiles()">−</button>
      <button type="button" aria-label="Показать все" @click="fitAll">⌂</button>
    </div>
    <div class="map-attribution">© OpenStreetMap contributors</div>
  </div>
</template>
