# Goal

Add a real-time preview of the current sheet being generated during TTS export, showing users visual feedback of the export process without interfering with the hidden image generation.

# Ordered Items

1. **Create TtsPreview component using existing exportIndex**
   How (implementation):
   - Build `TtsPreview.svelte` component with props: `sheet: Sheet`, `isVisible: boolean`
   - Use same grid layout as TtsExport: `grid grid-cols-10`
   - Clone SVGs from `sheet.svgs` independently (separate DOM elements)
   - Apply same SVG styling as TtsExport (remove width/height, set preserveAspectRatio)
   - Scale container to fit viewport using CSS transforms

2. **Add preview to main page using current sheet from exportIndex**
   How (implementation):
   - Use existing `exportingSheet = $derived(sheets[exportIndex])`
   - Add preview component: `<TtsPreview sheet={exportingSheet} isVisible={exportIndex < sheets.length && !finished} />`
   - Position between progress section and hidden export section
   - No additional state management needed - leverages existing reactivity

3. **Style preview with responsive scaling and container**
   How (implementation):
   - Container: `max-h-64 overflow-hidden border rounded-lg shadow-sm`
   - Scale calculation: `transform: scale(${containerWidth / 4096})`
   - Center preview: `flex justify-center items-center`
   - Handle empty/loading state gracefully
   - Acceptance: Preview shows current sheet content, scales properly, appears/disappears with export state
