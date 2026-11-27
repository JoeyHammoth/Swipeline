# Custom card templates

The default card renders every field of a [`Card`](/concepts/cards-and-adapters) in
a fixed order. Real products usually want their own markup.

## Built-in templates

| Template | Best for | Renders |
|---|---|---|
| `text` | papers, news, docs | title, subtitle, tags, clamped body |
| `media` | food, fashion, galleries | hero media, title, tags |
| `facts` | products, rentals | media, title, `facts` strip, price/rating |
| `compare` | side-by-side comparisons (later) | two cards |

```tsx
<SwipeDeck store={books} template="facts" />
```

```html
<swipe-deck template="facts"></swipe-deck>
```

The template decides *which fields* render, not how they look; both bindings read
the same selection from `cardView(card, template)` in `@swipeline/cards`, so a deck
looks the same in React and the Web Component. An unknown template is an error: it
throws in `cardView`, and the element emits an `error` event and keeps the previous
template.

## React: render prop

```tsx
<SwipeDeck
  deck={books}
  renderCard={(card) => (
    <article className="my-card">
      {card.media?.[0] && (
        <img src={card.media[0].url} alt={card.media[0].alt ?? ''} loading="lazy" />
      )}
      <h2>{card.title}</h2>
      {card.subtitle && <p>{card.subtitle}</p>}
      <ul>{card.tags?.slice(0, 4).map((tag) => <li key={tag}>{tag}</li>)}</ul>
      {card.facts && (
        <dl>
          {card.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}{fact.unit ? ` ${fact.unit}` : ''}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.attribution && <Attribution {...card.attribution} />}
    </article>
  )}
/>
```

## Web Component: renderer or slot

The element takes a renderer when the markup needs card data:

```ts
const deck = document.querySelector('swipe-deck')
deck.renderCard = (card) => {
  const article = document.createElement('article')
  article.className = 'my-card'
  const heading = document.createElement('h2')
  heading.textContent = card.title
  article.append(heading)
  return article
}
```

A light-DOM child with `slot="card"` replaces the default template with static
markup, as a slot normally does — it is not filled in per card. Use `renderCard`
when the content depends on the card.

Styling goes through CSS custom properties and the `card`, `actions` and `button`
parts; see the [theming reference](/reference/theming).

## Rules that keep templates portable

1. **Render from the card, not from side state.** If a template needs data the
   card does not carry, it belongs in `extra`.
2. **Always render attribution when present.** Some sources require it; hiding it
   breaks the terms of the source.
3. **Handle missing media.** Text-only cards are normal, not an error case.
4. **Keep the actions reachable.** A custom card must not swallow the buttons or
   keyboard handlers.
5. **Alt text matters.** If a source has no alt text, describe the item, do not
   repeat the title.

## Theming tokens

The full table, dark-mode values and a worked override live in the
[theming reference](/reference/theming). The short version:

| Token | Purpose |
|---|---|
| `--swl-color-bg`, `--swl-color-fg`, `--swl-color-accent` | Surfaces and text |
| `--swl-radius-card`, `--swl-radius-control` | Shape |
| `--swl-space-1…6` | Spacing scale |
| `--swl-motion-fast`, `--swl-motion-slow` | Durations; set to `0ms` for reduced motion |

Dark mode follows `prefers-color-scheme`; a `data-theme="dark"` or `"light"`
attribute overrides it. React Native uses the same token names in a theme object,
so a brand can share one palette.
