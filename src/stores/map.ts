import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import markerData from '../data/mock.json'
import type { MapMarker } from '../types'

export const useMapStore = defineStore('map', () => {
  const markers = markerData.markers as MapMarker[]
  const visibleIds = ref(new Set<number>(markers.map((marker) => marker.id)))
  const selectedId = ref<number | null>(null)
  const isReady = ref(true)

  const groups = computed(() => {
    const result = new Map<string, MapMarker[]>()
    markers.forEach((marker) => {
      const group = result.get(marker.title) ?? []
      group.push(marker)
      result.set(marker.title, group)
    })
    return result
  })

  const visibleMarkers = computed(() => markers.filter((marker) => visibleIds.value.has(marker.id)))

  function toggleMarker(id: number) {
    const next = new Set(visibleIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    visibleIds.value = next
    if (!next.has(id) && selectedId.value === id) selectedId.value = null
  }

  function clear() {
    visibleIds.value = new Set()
    selectedId.value = null
    isReady.value = false
  }

  function restore() {
    visibleIds.value = new Set(markers.map((marker) => marker.id))
    selectedId.value = null
    isReady.value = true
  }

  function select(id: number | null) {
    selectedId.value = id
  }

  function colorForTitle(title: string) {
    const titles = Array.from(groups.value.keys())
    const index = titles.indexOf(title)
    const hue = Math.round((index * 137.508) % 360)
    return `hsl(${hue} 72% 45%)`
  }

  const lines = computed(() => {
    const result: Array<{ title: string; points: [number, number][]; color: string }> = []
    groups.value.forEach((group, title) => {
      const points = group
        .filter((marker) => visibleIds.value.has(marker.id))
        .sort((a, b) => a.id - b.id)
        .map((marker) => [marker.latitude, marker.longitude] as [number, number])
      if (points.length >= 2) result.push({ title, points, color: colorForTitle(title) })
    })
    return result
  })

  return { markers, groups, visibleMarkers, visibleIds, selectedId, isReady, lines, toggleMarker, clear, restore, select, colorForTitle }
})
