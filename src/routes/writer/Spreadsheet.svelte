<script lang="ts">
  import { onMount } from 'svelte';
  import jspreadsheet, { type Column, type WorksheetInstance } from 'jspreadsheet-ce';

  export let data: string[][] = [[]];
  export let columns: Column[] = [];
  let spreadsheetContainer: HTMLDivElement;
  let spreadsheetInstance: WorksheetInstance[];

  onMount(() => {
    spreadsheetInstance = jspreadsheet(spreadsheetContainer, {
      worksheets: [
        {
          data,
          columns
        }
      ]
    });
  });
</script>

<div bind:this={spreadsheetContainer}></div>
