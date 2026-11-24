export interface BindingHandle {
  root: HTMLElement
  /** Resolves after pending engine work has rendered. */
  settle(): Promise<void>
  destroy(): void
}

export interface BindingFixture {
  name: string
  mount(): Promise<BindingHandle>
}

export interface BindingConformanceOptions {
  /** Title the fixture's first card must render. */
  firstTitle: string
  /** Title shown after one like, when the fixture has a second card. */
  secondTitle?: string
}

export interface BindingReport {
  binding: string
  checks: number
}

export class BindingConformanceError extends Error {
  readonly failures: readonly string[]

  constructor(binding: string, failures: readonly string[]) {
    super(`Binding "${binding}" failed conformance:\n- ${failures.join('\n- ')}`)
    this.name = 'BindingConformanceError'
    this.failures = failures
  }
}

async function tick(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function textOf(root: HTMLElement): string {
  // Shadow roots are part of the binding's rendered surface.
  const shadow = root.shadowRoot?.textContent ?? ''
  return `${root.textContent ?? ''} ${shadow}`.replace(/\s+/g, ' ').trim()
}

function press(root: HTMLElement, key: string): void {
  const target = root.shadowRoot?.activeElement ?? root
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
}

/**
 * The checks every binding must pass: render from a snapshot, a button per
 * action, keyboard and undo, a polite live region, and clean teardown. The
 * fixture owns mounting; this suite owns the assertions, so React, the Web
 * Component and future bindings run the same expectations.
 */
export async function assertBindingConformance(
  fixture: BindingFixture,
  options: BindingConformanceOptions,
): Promise<BindingReport> {
  const failures: string[] = []
  let checks = 0
  let handle: BindingHandle | undefined

  try {
    handle = await fixture.mount()
    await handle.settle()
    await tick()
    checks += 1
    if (!textOf(handle.root).includes(options.firstTitle)) {
      failures.push(`did not render the first card title "${options.firstTitle}"`)
    }

    const searchRoot = handle.root.shadowRoot ?? handle.root
    checks += 1
    const controls = searchRoot.querySelectorAll('[data-action]')
    if (controls.length < 4) {
      failures.push(`rendered ${controls.length} action controls, expected at least 4`)
    }

    checks += 1
    if (!searchRoot.querySelector('[aria-live="polite"]')) {
      failures.push('has no polite live region')
    }

    checks += 1
    const before = textOf(handle.root)
    press(handle.root, 'ArrowRight')
    await handle.settle()
    await tick()
    if (textOf(handle.root) === before) {
      failures.push('ArrowRight did not advance the deck')
    }
    if (options.secondTitle && !textOf(handle.root).includes(options.secondTitle)) {
      failures.push(`ArrowRight did not render the second card "${options.secondTitle}"`)
    }

    checks += 1
    press(handle.root, 'u')
    await handle.settle()
    await tick()
    if (options.secondTitle && !textOf(handle.root).includes(options.firstTitle)) {
      failures.push('undo did not restore the first card')
    }

    checks += 1
    if (!(handle.root instanceof HTMLElement)) {
      failures.push('root is not an HTMLElement')
    }
  } catch (cause) {
    failures.push(`threw: ${cause instanceof Error ? cause.message : String(cause)}`)
  } finally {
    try {
      handle?.destroy()
      checks += 1
      if (handle?.root.isConnected) failures.push('destroy left the root attached to the document')
    } catch (cause) {
      failures.push(`destroy threw: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  if (failures.length > 0) throw new BindingConformanceError(fixture.name, failures)
  return { binding: fixture.name, checks }
}
