<script setup lang="ts">
import { formatServiceTimestamp } from '../../js/time'

const { $api } = useNuxtApp()

const { data: health, error, pending, refresh } = await useAsyncData(
  'health-check',
  async () => {
    const response = await $api.health.get()

    if (response.error) {
      throw createError({
        statusCode: response.status || 500,
        statusMessage: 'Unable to reach the service API',
      })
    }

    return response.data
  }
)

const checkedAt = computed(() => formatServiceTimestamp(health.value?.checkedAt))
</script>

<template>
  <main class="page-shell">
    <section class="status-panel" aria-labelledby="page-title">
      <div class="status-copy">
        <p class="eyebrow">Patshop On-Demand</p>
        <h1 id="page-title">Nuxt website connected to Elysia API</h1>
        <p class="intro">
          The Nuxt app is mounted with <code>nuxt-elysia</code> and calls the
          service API through Eden Treaty.
        </p>
      </div>

      <div class="health-card" aria-live="polite">
        <div class="card-header">
          <span class="status-dot" :class="{ 'status-dot--error': error }" />
          <span>Service health</span>
        </div>

        <dl v-if="health" class="health-list">
          <div>
            <dt>Status</dt>
            <dd>{{ health.status }}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{{ health.service }}</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>{{ checkedAt }}</dd>
          </div>
        </dl>

        <p v-else-if="pending" class="muted">Checking service API...</p>
        <p v-else class="muted">Service API is not reachable.</p>

        <button type="button" class="refresh-button" @click="refresh()">
          Refresh status
        </button>
      </div>
    </section>
  </main>
</template>
