# Goal

Restructure export functionality to use a layout-based context pattern where project processing happens once in a layout file and separate TTS/Paper pages consume the processed project data through context.

# Ordered Items

1. **Create export context module**
   How (implementation):
   - Create `src/routes/games/[gameName]/export/export-context.svelte.ts`
   - Define context keys and classes for project data sharing
   - Include: `ProjectData` class with projects array, loading state, and error handling
   - Export `setExportContext` and `getExportContext` functions
   - Mirror the pattern used in `svg-context.svelte.ts`

2. **Create export layout file**
   How (implementation):
   - Create `src/routes/games/[gameName]/export/+layout.svelte`
   - Extract project processing logic from `bulk-export.svelte` (lines 17-95)
   - Process projects with `getFoldersToExport()` function
   - Set context using `setExportContext()` with processed projects
   - Use `$effect` to handle async loading similar to deck layout
   - Include loading states and error handling
   - Render `{@render children()}` at the end

3. **Create TTS export page**
   How (implementation):
   - Create `src/routes/games/[gameName]/export/tts/+page.svelte`
   - Import `getExportContext()` to access processed projects
   - Extract TTS-specific logic from `bulk-export.svelte` (lines 97-198)
   - Include progress tracking, TTS sheet generation, and JSON save functionality
   - Use existing `TtsExport` component for image generation
   - Handle TTS-specific file naming and structure

4. **Create Paper export page**
   How (implementation):
   - Create `src/routes/games/[gameName]/export/paper/+page.svelte`
   - Import `getExportContext()` to access processed projects
   - Use existing `ExportPages` component for paper layout
   - Include print configuration and page layout logic
   - Handle paper-specific settings (A4, margins, etc.)
   - No additional processing needed, just consume context

5. **Test and verify functionality**
   How (implementation):
   - Navigate to `/games/{gameName}/export/tts` and verify TTS export works
   - Navigate to `/games/{gameName}/export/paper` and verify paper export works
   - Ensure project processing happens only once in layout
   - Verify context is properly shared between pages
   - Test navigation between export types maintains state
   - Acceptance: Both export types work identically to current `bulk-export.svelte`
