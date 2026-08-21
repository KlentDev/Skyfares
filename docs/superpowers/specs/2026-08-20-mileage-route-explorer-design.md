# Skyfare Mileage Route Explorer

## Technical decision

The explorer uses a dependency-free SVG renderer with an equirectangular `1000 × 500` viewBox. This is the best fit for the homepage because the visual requirement is a quiet, outlined/dotted world rather than a navigable street map. The map has no tiles, runtime map package, API key, or third-party network request.

The land silhouette is a local, simplified 110m Natural Earth-derived asset generated from the `world-atlas` land topology and checked into `images/world-map-outline.svg`. SVG paths keep the asset styleable with the existing Skyfare tokens and keep route nodes, arcs, labels, and keyboard targets in one accessible coordinate system. D3-geo was considered for its projection model, but adds no value for this fixed equirectangular projection, so no runtime library is shipped.

## Shared data feed

`js/mileage-route-data.js` is the canonical source for the 67 Mileage Route Board destinations. It exposes `window.SKYFARE_MILEAGE_ROUTES` with the Singapore/SIN origin, normalized route objects, exact saver and advantage awards, regions, cabin, airport codes, coordinates, and optional airline/image metadata.

The homepage route search and `js/krisflyer.js` consume this source directly. `js/mileage-route-explorer.js` transforms each route’s latitude/longitude into SVG coordinates, creates the shortest-longitude quadratic arc, and derives the route count, filters, search results, range summary, quick-access Popular Routes pills, browse dialog, and selected-route state from the same array.

`js/route-modal.js` owns the shared route-detail presenter. Map nodes, arcs, Popular Routes pills, browse results, and Hero search all render into the same floating map card, so route content cannot drift between entry points. `window.SKYFARE_ROUTE_STATE` carries the selected route and a pending map destination while the explorer is lazy-initialized.

## Interaction and performance

- The section reserves map space with a fixed aspect ratio to protect layout stability.
- Initialization waits for `IntersectionObserver`; the world outline is fetched only when the section approaches the viewport.
- Fine pointers get hover previews. Click/tap selects a route, focuses the viewBox with padded route framing, and renders the shared floating route card; the dedicated browse dialog contains search, region filtering, and all route starting points. Route arcs/nodes, Popular Routes pills, and directory buttons are keyboard reachable.
- The airplane artwork is locally flipped to align its nose with the path tangent while SVG `animateMotion rotate="auto"` continuously follows curves. Reduced-motion mode disables movement and snaps viewport changes.
- The selected route alone receives a subtle SVG airplane motion along its arc. Reduced-motion mode removes that motion and keeps the route emphasis static.
- Search and region filtering live inside a dedicated browse dialog, while the route directory and live status text provide a semantic fallback when JavaScript or the map asset is unavailable.
