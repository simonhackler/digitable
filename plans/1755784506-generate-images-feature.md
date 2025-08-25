# Goal

Implement a batch image generation feature for the SVG table editor that creates AI-generated images for selected image columns/rows. Users select image cells in the spreadsheet, enter a prompt template with column references, and generate images that can be previewed and applied to update the cards.

# Ordered Items

1. **Add Generate Images button to toolbar with activation logic and empty modal component** ✅ COMPLETED
   How (implementation):
   - ✅ Create empty `generate-images-modal.svelte` component with basic shadcn Dialog structure (Dialog.Root, Dialog.Trigger, Dialog.Content)
   - ✅ Add "Generate Images" button to `toolbar.svelte` next to existing "Add Svg data" and "Flip cards" buttons
   - ✅ Import and wire up the empty modal component to open/close on button click
   - ✅ Add props to toolbar for selection state and spreadsheet access: `selection: SelectionBounds | null, spreadsheet: jspreadsheet.WorksheetInstance, onGenerateImages: () => void`
   - ✅ Pass selection data (selection bounds) and spreadsheet instance from parent component (`svg-data-editor.svelte`)
   - ✅ Button disabled when no image columns are selected (checked via derived value that inspects `spreadsheet.getConfig().columns[x].type === 'image'`)
   - ✅ Uses simple selection bounds instead of complex pre-processed data structure
   - ✅ Proper TypeScript typing with `jspreadsheet.WorksheetInstance` as required prop
   - Acceptance: Button appears in toolbar, modal opens/closes, button disabled when no image columns selected

2. **Implement selection processing to identify image columns and rows**
   How (implementation):
   - Modify `onselection` callback in `svg-data-editor.svelte` to extract selected coordinates
   - Filter columns using `spreadsheet[0].getHeaders(true)` and match against column definitions with `type: 'image'`
   - Build generation queue data structure: `{rowIndex: number, columnId: string, rowData: string[], columnType: string}[]`
   - Store selection state in component: `let selectionData = $state({hasImageColumns: false, generationQueue: []})`
   - Pass processed selection data to modal component via props
   - Edge case: Handle mixed selections (text + image columns) by filtering to image-only
   - Acceptance: Selection processing correctly identifies image columns and builds generation queue

3. **Create image generation modal component with prompt template input**
   How (implementation):
   - Build out modal content using shadcn components: Dialog.Header, Dialog.Title, Input, Button, Label
   - Text input for prompt template with placeholder text: "Enter prompt with {column_name} references"
   - Display selection summary: "Generating X images for Y rows across Z image columns"
   - Add Prompt creator from spreadsheet data. Allow building prompt from spreadsheet data
   - Show list of available column placeholders for reference
   - Allow editing of the generated prompts
   - Generate button to start process, Cancel button to close modal
   - Props interface: `{open: boolean, selectionData: SelectionData, onGenerate: (prompt: string) => void, onClose: () => void}`
   - Form validation: Ensure prompt is not empty before enabling Generate button
   - Acceptance: Modal displays selection info, accepts prompt input, validates before generation

4. **Build AI image generation service integration**
   How (implementation):
   - Create `lib/utils/image-generator.ts` service module with placeholder AI API
   - Function signature: `generateImage(prompt: string, width: number, height: number): Promise<Blob>`
   - Implement prompt template replacement: `prompt.replace(/{(\w+)}/g, (match, columnName) => rowData[columnIndex])`
   - Determine image dimensions from SVG using `svg.querySelector(\`#\${columnId}\`)?.getBBox()` or default 512x512
   - Sequential processing with progress state: `{current: number, total: number, status: 'generating' | 'complete'}`
   - Return generated image blobs for file storage
   - Error handling: Log failures but continue with remaining images
   - Acceptance: Service generates placeholder images, processes prompts sequentially, reports progress

5. **Create image selection interface for apply/keep decisions**
   How (implementation):
   - New modal component `image-selection-modal.svelte` using shadcn Dialog and Card components
   - Display grid of generated images grouped by row, showing: original image, generated image, row data context
   - Individual controls per image: "Apply" and "Keep Original" buttons
   - Bulk action buttons: "Apply All", "Keep All Original" in dialog footer
   - Props: `{images: GeneratedImage[], onApply: (selections: ApplySelection[]) => void}`
   - Data structure: `GeneratedImage = {rowIndex: number, columnId: string, originalPath: string, generatedBlob: Blob, applied: boolean}`
   - Visual feedback: Highlight applied vs original selections
   - Acceptance: Interface shows all generated images with apply/keep options and bulk actions

6. **Implement file storage system for generated images using existing filesystem**
   How (implementation):
   - Use existing `fileSystem.upload()` method from Adapter interface in `svg-data-editor.svelte`
   - Create directory structure: `/${projectName}/files/generated/${cardName}/batch_${Date.now()}/`
   - Convert image blobs to File objects with naming: `${rowIndex}_${columnId}.png`
   - Batch upload all applied images: `await Promise.all(appliedImages.map(img => fileSystem.upload(file, directory)))`
   - Generate metadata JSON file with generation details: `{timestamp, prompt, selections: [{rowIndex, columnId, filename, applied}]}`
   - Update file paths for applied images: `generated/${cardName}/batch_${timestamp}/${filename}`
   - Leverage existing upload patterns from `addImageAndUpdateSvg` function
   - Acceptance: Images stored in organized structure, metadata saved, file paths updated

7. **Integrate with spreadsheet data updates and SVG card regeneration**
   How (implementation):
   - Update spreadsheet cell values using `spreadsheet[0].setValueFromCoords(columnIndex, rowIndex, newImagePath)`
   - Trigger existing SVG card regeneration by calling `updateSvg(cards[rowIndex].front, columnId, newImagePath, imagePaths)`
   - Update `imagePaths` Map with new generated image URLs using existing `addImageAndUpdateSvg` pattern
   - Call `imagePaths.set(newImagePath, URL.createObjectURL(imageBlob))` for immediate preview
   - Ensure debounced CSV save triggers via existing `onafterchanges` callback to persist changes
   - Batch process all applied image updates to avoid multiple CSV saves
   - Edge case: Handle concurrent edits by checking if selection is still valid
   - Acceptance: Spreadsheet updates with new paths, SVG cards regenerate, changes persist to CSV
