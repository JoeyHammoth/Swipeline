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
<SwipeDeck deck={books} template="facts" />
```

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

## Web Component: slots

```html
<swipe-deck deck-id="books" query="science fiction">
  <template slot="card">
    <article class="my-card">
      <h2 data-field="title"></h2>
      <p data-field="subtitle"></p>
      <img data-field="image" alt="" />
      <p data-field="body"></p>
    </article>
  </template>
</swipe-deck>
```

The element fills `data-field` nodes from the current card. Styling goes through
CSS custom properties and `::part()`; see the theming tokens.

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

| Token | Purpose |
|---|---|
| `--swl-color-bg`, `--swl-color-fg`, `--swl-color-accent` | Surfaces and text |
| `--swl-radius-card`, `--swl-radius-control` | Shape |
| `--swl-space-1…6` | Spacing scale |
| `--swl-motion-fast`, `--swl-motion-slow` | Durations; set to `0ms` for reduced motion |

Dark mode follows `prefers-color-scheme`; a `data-theme="dark"` or `"light"`
attribute overrides it. React Native uses the same token names in a theme object,
so a brand can share one palette.
