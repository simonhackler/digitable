# Generate Images Feature Specification

## Description

A batch image generation feature for the SVG table editor that creates AI-generated images for selected image columns/rows. Users select image cells in the spreadsheet, enter a prompt template with column references, and generate images that can be previewed and applied to update the cards.

The feature integrates with the existing spreadsheet selection system and SVG card rendering pipeline. Generated images are stored in the project file system and can be applied to replace existing image references in the spreadsheet data.

## Scope

### In Scope

- "Generate Images" button in toolbar that activates when image columns are selected
- Support for mixed selections (filters to only process image columns)
- Generation dialog with prompt template input supporting `{column_name}` references
- Sequential image generation (one image per selected image cell)
- Image selection interface showing generated images with apply/keep original options
- Automatic image sizing based on SVG image element dimensions
- File storage in `/${projectName}/files/generated/${cardName}/batch_${timestamp}/` structure
- Bulk selection actions (Apply All, Keep All Original)
- Integration with existing spreadsheet and SVG card update mechanisms

### Out of Scope

- AI service selection/configuration (will be added later)
- Style presets or generation options
- Multiple variations per image (default: 1 image per cell)
- Error handling for failed generations
- Concurrent/parallel image generation
- Dialog state persistence
- Undo functionality
- Pre-built prompt templates

## Implementation Details

### Button Activation Logic

- Monitor spreadsheet selection changes
- Enable "Generate Images" button when selection contains any columns with `type: 'image'`
- Extract only image columns from mixed selections

### Selection Processing

- Identify selected rows and image columns from spreadsheet selection
- Calculate total images to generate (rows × image columns)
- Build generation queue with row data and column references

### Image Generation

- Sequential processing of generation queue
- Build prompts by replacing `{column_name}` placeholders with row data
- Determine image dimensions from SVG `<image>` element attributes
- Generate images using configured AI service
- Store images with naming pattern: `${rowIndex}_${columnId}.png`

### Image Selection Interface

- Display generated images grouped by row and column
- Show apply/keep original buttons for each image
- Provide bulk actions for all images
- Update spreadsheet data and regenerate SVG cards when images are applied

### File Management

- Store generated images in organized directory structure
- Include metadata file with generation details
- Update image path mappings when images are applied
- Clean up unused generated images (implementation dependent)
