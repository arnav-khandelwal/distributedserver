/**
 * Service Worker — Distributed Node PWA
 *
 * Minimal setup: installs and activates silently.
 * Caching strategies and offline support will be added in a later step.
 */

const SW_VERSION = 'v0.1.0'

self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing…`)
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activated`)
  // Take control of all open clients without requiring a reload
  event.waitUntil(self.clients.claim())
})

// Fetch handler — pass-through (no caching yet)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
