import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const PANEL_ID = '@syncended/dsh-usage'
const FOOTER = 'sidebar.footer.action'

function eventTarget() {
  const listeners = []
  const added = []
  return {
    listeners, added,
    addEventListener(type, listener, capture) {
      const entry = { type, listener, capture }
      listeners.push(entry); added.push(entry)
    },
    removeEventListener(type, listener, capture) {
      const index = listeners.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === capture)
      assert.notEqual(index, -1, `removing an unknown ${type} listener`)
      listeners.splice(index, 1)
    },
    dispatch(type, event) {
      for (const entry of [...listeners]) if (entry.type === type) entry.listener(event)
    },
  }
}

// Model declaration-scoped inject callbacks and context disposal, including
// slots that do not exist yet when the plugin applies.
function slotHost(initialNames) {
  const declared = new Set(initialNames), injections = [], registrations = [], cleanups = []
  const active = new Set()
  const once = (fn) => {
    let done = false
    return () => { if (!done) { done = true; fn?.() } }
  }
  const slots = {
    inject(name, callback) {
      const entry = { name, callback, cleanup: null }
      injections.push(entry)
      if (declared.has(name)) entry.cleanup = callback()
      const dispose = once(() => {
        entry.cleanup?.(); entry.cleanup = null
        injections.splice(injections.indexOf(entry), 1)
      })
      cleanups.push(dispose)
      return dispose
    },
    register(options, component) {
      assert.ok(declared.has(options.name), `slot ${options.name} must be declared before registration`)
      const entry = { options, component, removals: 0 }
      registrations.push(entry); active.add(entry)
      return () => {
        entry.removals++
        assert.ok(active.delete(entry), 'registration must be unregistered exactly once')
      }
    },
  }
  return {
    slots, injections, registrations, active,
    effect(callback) { const dispose = once(callback()); cleanups.push(dispose); return dispose },
    declare(name) {
      assert.ok(!declared.has(name))
      declared.add(name)
      for (const entry of injections) if (entry.name === name) entry.cleanup = entry.callback()
    },
    undeclare(name) {
      assert.ok(declared.delete(name))
      for (const entry of injections) if (entry.name === name) { entry.cleanup?.(); entry.cleanup = null }
    },
    registration(name) {
      const matches = [...active].filter((entry) => entry.options.name === name)
      assert.equal(matches.length, 1, `expected one active ${name} registration`)
      return matches[0]
    },
    dispose() { for (const cleanup of [...cleanups].reverse()) cleanup() },
  }
}

function setup({ modern = true, declared = ['main', FOOTER, 'conversation'] } = {}) {
  const host = slotHost(declared), documentEvents = eventTarget(), windowEvents = eventTarget()
  const styles = new Set(), frames = new Set(), selections = []
  let activePanelId = null, exports, componentCleanups = [], panelInfoReads = 0
  class Element {
    constructor(insideUsage = false) { this.insideUsage = insideUsage }
    closest(selector) {
      assert.equal(selector, '.dsh-usage-sidebar,.dsh-usage-workspace')
      return this.insideUsage ? this : null
    }
  }
  // Only initial workspace rendering is needed here. Keep the document hidden
  // so the real polling effect mounts and cleans up without starting a request.
  // Footer renders explicitly reread the supplied external-store snapshot.
  const react = {
    ...React,
    useId: () => 'navigation-usage-title',
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useCallback: (callback) => callback,
    useEffect: (callback) => { const cleanup = callback(); if (cleanup) componentCleanups.push(cleanup) },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  vm.runInNewContext(client, {
    window: {
      ...windowEvents,
      __ModuleLoader__: { load({ id, factory }) {
        assert.equal(id, PANEL_ID)
        exports = factory((name) => { assert.equal(name, 'react'); return react })
      } },
    },
    document: {
      ...documentEvents, hidden: true,
      head: { appendChild: (tag) => styles.add(tag) },
      createElement(name) {
        assert.equal(name, 'style')
        const tag = { setAttribute() {}, remove() { assert.ok(styles.delete(tag)) } }
        return tag
      },
    },
    Element, AbortController, Intl, console,
    fetch() { assert.fail('navigation tests must not issue network requests') },
    setTimeout() { assert.fail('hidden workspace must not schedule polling') },
    clearTimeout() {},
    requestAnimationFrame() { const frame = {}; frames.add(frame); return frame },
    cancelAnimationFrame(frame) { assert.ok(frames.delete(frame)) },
  })
  const layout = modern ? { selectPanel(id) { assert.equal(this, layout); selections.push(id) } } : {}
  assert.deepEqual(Array.from(exports.inject), ['slots', 'layout'])
  exports.apply({ slots: host.slots, effect: host.effect, layout })
  const render = (entry, props = {}) => entry.component({ ...props, ...entry.options.inject() })
  return {
    host, styles, frames, selections, documentEvents, windowEvents, Element,
    get panelInfoReads() { return panelInfoReads },
    navigate(id) { activePanelId = id },
    footer(wide = true) {
      const wrapper = render(host.registration(FOOTER), {
        wide,
        usePanelInfo(selector) { panelInfoReads++; return selector({ activePanelId }) },
      })
      return findElement(wrapper.type(wrapper.props), (node) => node.type === 'button')
    },
    workspace(name = 'main') { return render(host.registration(name)) },
    unmountWorkspace() {
      for (const cleanup of componentCleanups.reverse()) cleanup()
      componentCleanups = []
    },
    dispose() { this.unmountWorkspace(); host.dispose() },
  }
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (!Array.isArray(node) && predicate(node)) return node
  for (const child of Array.isArray(node) ? node : [node.props?.children]) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

function assertFooter(button, open, message) {
  assert.equal(button.props['aria-pressed'], open, message)
  assert.equal(button.props['aria-label'], open ? 'Close Usage' : 'Open Usage')
  assert.equal(button.props['data-active'], open ? 'true' : undefined)
}

function assertModernOnly(env) {
  assert.ok(env.host.injections.every(({ name }) => name !== 'conversation'))
  assert.ok(env.host.registrations.every(({ options }) => options.name !== 'conversation'))
  assert.ok(env.documentEvents.added.every(({ type }) => type !== 'pointerdown'))
}

function assertDisposed(env) {
  assert.equal(env.host.active.size, 0)
  assert.equal(env.host.injections.length, 0)
  assert.ok(env.host.registrations.every(({ removals }) => removals === 1))
  assert.equal(env.styles.size, 0)
  assert.equal(env.frames.size, 0)
  assert.equal(env.documentEvents.listeners.length, 0)
  assert.equal(env.windowEvents.listeners.length, 0)
}

test('modern navigation registers a keyed main panel, including late declaration and cleanup', () => {
  const env = setup({ declared: [] })
  assert.deepEqual(env.host.injections.map(({ name }) => name), ['main', FOOTER])
  assert.equal(env.host.active.size, 0)
  assert.deepEqual(env.selections, [], 'applying the plugin must not select Usage')
  env.host.declare(FOOTER)
  env.host.declare('main')
  const main = env.host.registration('main')
  assert.equal(main.options.key, PANEL_ID)
  assert.equal(env.host.registration(FOOTER).options.id, 'usage')
  assert.equal(env.host.registration(FOOTER).options.label, 'Usage')
  assertFooter(env.footer(), false)
  env.host.undeclare('main')
  assert.equal(main.removals, 1)
  env.host.declare('main')
  assert.equal(env.host.registration('main').options.key, PANEL_ID)
  assertModernOnly(env)
  env.dispose()
  assertDisposed(env)
  env.host.declare('conversation')
  assert.equal(env.host.active.size, 0, 'disposed injections must not react to late declarations')
})

test('modern footer opens and toggles from supplied panel info, tracking external navigation', () => {
  const env = setup()
  const main = env.host.registration('main')
  assert.equal(main.options.key, PANEL_ID)
  assertFooter(env.footer(), false)
  env.footer().props.onClick()
  assert.deepEqual(env.selections, [PANEL_ID])
  assertFooter(env.footer(), false, 'selection is controlled by the layout, not local state')
  env.navigate(PANEL_ID)
  assertFooter(env.footer(), true)
  env.footer().props.onClick()
  assert.deepEqual(env.selections, [PANEL_ID, null])
  env.navigate(null)
  assertFooter(env.footer(), false)
  env.navigate(PANEL_ID) // External navigation can also activate Usage.
  assertFooter(env.footer(false), true)
  env.navigate('@another/plugin')
  assertFooter(env.footer(false), false)
  env.footer(false).props.onClick()
  assert.deepEqual(env.selections, [PANEL_ID, null, PANEL_ID], 'reopening after external navigation must not issue a stale close')
  assert.ok(env.panelInfoReads >= 8)
  assert.equal(env.host.registration('main'), main, 'closed panels stay registered')
  assertModernOnly(env)
  env.dispose()
  assertDisposed(env)
})

test('modern workspace Close and unhandled Escape clear panel selection and clean up listeners', () => {
  const env = setup()
  env.navigate(PANEL_ID)
  const tree = env.workspace()
  const close = findElement(tree, (node) => node.type === 'button' && node.props['data-dsh-usage-exit'] === 'true')
  assert.ok(close, 'workspace exposes its real Close control')
  close.props.onClick()
  assert.deepEqual(env.selections, [null])
  const event = (key, defaultPrevented = false) => ({ key, defaultPrevented, preventDefault() { this.defaultPrevented = true } })
  env.windowEvents.dispatch('keydown', event('Enter'))
  env.windowEvents.dispatch('keydown', event('Escape', true))
  assert.deepEqual(env.selections, [null], 'handled Escape and unrelated keys must not close')
  const escape = event('Escape')
  env.windowEvents.dispatch('keydown', escape)
  assert.equal(escape.defaultPrevented, true)
  assert.deepEqual(env.selections, [null, null])
  assertModernOnly(env)
  env.unmountWorkspace()
  env.windowEvents.dispatch('keydown', event('Escape'))
  assert.deepEqual(env.selections, [null, null], 'unmounted workspaces must not handle Escape')
  assert.equal(env.host.active.size, 2, 'workspace unmount does not unregister modern panel definitions')
  env.dispose()
  assertDisposed(env)
})

test('legacy layout mounts conversation on click and removes it on close or external navigation', () => {
  const env = setup({ modern: false })
  assert.deepEqual(env.host.injections.map(({ name }) => name), ['conversation', FOOTER])
  assert.equal(env.host.active.size, 1)
  assertFooter(env.footer(), false)
  assert.equal(env.documentEvents.listeners.filter(({ type, capture }) => type === 'pointerdown' && capture === true).length, 1)
  env.footer().props.onClick()
  assertFooter(env.footer(), true)
  const first = env.host.registration('conversation')
  assert.equal(first.options.priority, -190)
  const close = findElement(env.workspace('conversation'), (node) => node.props?.['data-dsh-usage-exit'] === 'true')
  close.props.onClick()
  env.unmountWorkspace()
  assert.equal(first.removals, 1)
  assertFooter(env.footer(), false)
  env.footer().props.onClick()
  const second = env.host.registration('conversation')
  env.documentEvents.dispatch('pointerdown', { target: new env.Element(true) })
  env.documentEvents.dispatch('pointerdown', { target: {} })
  assert.equal(env.host.registration('conversation'), second, 'Usage descendants and non-elements do not dismiss')
  env.documentEvents.dispatch('pointerdown', { target: new env.Element() })
  assert.equal(second.removals, 1)
  assertFooter(env.footer(), false)
  env.footer().props.onClick()
  env.footer().props.onClick()
  assert.equal(env.host.active.size, 1, 'legacy footer toggles the conversation registration off')
  env.footer().props.onClick() // Dispose while open to test the center cleanup.
  assert.deepEqual(env.selections, [])
  env.dispose()
  assertDisposed(env)
})

test('legacy navigation waits for late conversation declaration and unregisters across slot lifetimes', () => {
  const env = setup({ modern: false, declared: [FOOTER] })
  env.footer().props.onClick()
  assertFooter(env.footer(), true)
  assert.equal(env.host.active.size, 1, 'opening before conversation exists must defer registration')
  env.host.declare('conversation')
  const first = env.host.registration('conversation')
  env.host.undeclare('conversation')
  assert.equal(first.removals, 1)
  env.host.declare('conversation')
  assert.notEqual(env.host.registration('conversation'), first)
  env.dispose()
  assertDisposed(env)
})
