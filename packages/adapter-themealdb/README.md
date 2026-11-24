# @swipeline/adapter-themealdb

TheMealDB search results as recipe `Card`s: image, category, cuisine, tags,
instructions and source link.

```ts
import { createTheMealDbAdapter } from '@swipeline/adapter-themealdb'

const source = createTheMealDbAdapter({ apiKey: '1' })
```

`apiKey: '1'` is the free development key. Apply for a production key before a
public launch and keep it server-side; the adapter also accepts a function so the
key can rotate without rebuilding the source.

There is no pagination: a search returns the full result set, so the adapter
declares `none`. A `null` meal list is treated as an empty deck. Attribution to
TheMealDB is required; see
[TheMealDB](https://www.themealdb.com/api.php) for terms.
