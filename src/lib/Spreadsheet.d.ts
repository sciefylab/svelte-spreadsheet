import type { SvelteComponentTyped } from 'svelte';

/**
 * Represents an option in a select dropdown.
 */
export interface SelectOption {
  value: string | number;
  label: string;
}

/**
 * Represents the type of values that can be present in a RowDataForCallbacks object.
 * For 'select' columns, this will be the primitive value of the selection.
 */
export type RowDataValue = SelectOption['value'] | number | string | null;

/**
 * Represents the data of a single row, typically used in callback functions
 * like `column.function` or `column.onChange`.
 * Keys are column keys, values are the processed data for that cell.
 * For 'select' columns, the value is the primitive `value` of the selected option.
 * For 'number' columns, the value is a `number` or `null`.
 * For 'date' columns, the value is a 'YYYY-MM-DD' string or `null`.
 * For 'text' or 'function' columns, the value is a `string` or `null`.
 */
export type RowDataForCallbacks = Record<string, RowDataValue>;

/**
 * Defines the structure of a cell's value as stored in the grid.
 * For 'select' type, it's a SelectOption object.
 * For 'date' type, it's a 'YYYY-MM-DD' string.
 * For 'number' type, it's a string representation of the number (e.g., "123", "0.5").
 * For 'text' or 'function' types, it's a string.
 */
export interface WorksheetCell {
  value: SelectOption | string | null;
}

/**
 * Configuration for a single column in the spreadsheet.
 */
export interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'function';
  width?: string;
  options?: SelectOption[];
  fetchOptions?: (query: string, params?: Record<string, any>) => Promise<SelectOption[]>;
  fetchParamsFromColumns?: string[];
  readonly?: boolean;
  function?: (rowData: RowDataForCallbacks) => any;
  onChange?: (
    selectedOption: SelectOption,
    currentCell: WorksheetCell, // The grid cell object, e.g., { value: SelectOption }
    fullRowData: RowDataForCallbacks,
    allColumns: Column[]
  ) => Array<{ targetColumnKey: string; value: any }> | void;
  format?: string; // Example: "dd/mm/yyyy" for date display (internal is YYYY-MM-DD)
}

/**
 * Represents a row of data as returned by the `getAllData` method.
 * For 'select' columns, the value is a `SelectOption` object.
 * For 'number' columns, the value is a `number` or `null`.
 * For 'date' columns, the value is a 'YYYY-MM-DD' string or `null`.
 */
export interface AllDataRow {
  [key: string]: SelectOption | number | string | null;
}

/**
 * Represents a row of data for the `initialData` prop.
 * For 'select' columns, the value can be a `SelectOption` object or its primitive `value`.
 */
export interface InitialDataRow {
  [key: string]: SelectOption | SelectOption['value'] | number | string | null;
}

export interface Worksheet {
  name: string;
  grid: WorksheetCell[][];
}

export interface SpreadsheetProps {
  initialData: InitialDataRow[];
  columns: Column[];
  initialWorksheets?: Worksheet[] | null;
}

export interface SpreadsheetInstance {
  getAllData: () => AllDataRow[];
}

export default class Spreadsheet extends SvelteComponentTyped<SpreadsheetProps, Record<string, never>, Record<string, never>> {}W