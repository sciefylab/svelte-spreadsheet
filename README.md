# Svelte Spreadsheet 📊

[![npm version](https://badge.fury.io/js/%40sciefylab%2Fsvelte-spreadsheet.svg)](https://badge.fury.io/js/%40sciefylab%2Fsvelte-spreadsheet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A highly customizable and interactive spreadsheet component for Svelte, built with Svelte 5 Runes. Inspired by Excel and Google Sheets, it's designed to handle complex data interactions with ease.

## ✨ Features

* **Customizable Columns**: Define column types, labels, widths, and read-only status.
* **Multiple Data Types**: Supports `text`, `number`, `date`, `select`, and `function` cell types.
* **Asynchronous Options**: Dynamically fetch options for `select` dropdowns from an API.
* **Dependent Dropdowns**: Create cascading selects where one dropdown's options depend on another's value (e.g., cities based on the selected country).
* **Computed Columns**: Define columns whose values are calculated from other cells in the same row.
* **Programmatic Access**: Easily get all current data from the spreadsheet for submission or processing.
* **Multi-Worksheet Support**: Manage multiple sheets within a single spreadsheet instance.

---

## 💾 Installation

Install the package using npm (or your preferred package manager):

```bash
npm install @sciefylab/svelte-spreadsheet
```

---

## 🚀 How to Use

Here’s a comprehensive example demonstrating how to implement the `Svelte-Spreadsheet` component.

### 1. Import the Component

First, import the `Spreadsheet` component into your Svelte file.

```svelte
<script>
  // Make sure the import path matches your project structure
  import Spreadsheet from '@sciefylab/svelte-spreadsheet';
</script>
```

### 2. Define Columns and Data & 3. Render the Component

Define your column structure, initial data, and render the component. Use the `bind:this` directive to get a reference to the component instance. This allows you to call its public methods, like `getAllData()`.

```svelte
<script>
 import Spreadsheet from '@sciefylab/svelte-spreadsheet';

 let spreadsheetComponent; // Variable to hold the component instance

 const columns = [
  {
    key: "name",
    label: "Name",
    type: "select",
    width: "150px",
    // Fetch options from an external API
    fetchOptions: async (query) => {
      try {
        const response = await fetch('[https://jsonplaceholder.typicode.com/users](https://jsonplaceholder.typicode.com/users)');
        const users = await response.json();
        const options = users.map(user => ({ value: String(user.id), label: user.name }));
        // Filter results based on user input
        return options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()));
      } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
      }
    },
  },
  {
    key: "age",
    label: "Age",
    type: "number",
    width: "100px",
  },
  {
    key: "birthdate",
    label: "Birthdate",
    type: "date",
    width: "150px",
    format: "dd/mm/yyyy", // Custom date format
  },
  {
    key: "country",
    label: "Country",
    type: "select",
    width: "120px",
    options: [
      { value: "us", label: "United States" },
      { value: "ca", label: "Canada" },
      { value: "mx", label: "Mexico" },
    ],
    // Handle changes to update other cells
    onChange: (selectedOption) => {
      if (selectedOption.value === "us") {
        return [{ targetColumnKey: "city", value: { value: "ny", label: "New York" } }];
      } else {
        return [{ targetColumnKey: "city", value: "" }]; // Clear city if country changes
      }
    }
  },
  {
    key: "city",
    label: "City",
    type: "select",
    width: "120px",
    readonly: true, // This column is now controlled by the 'country' column
    fetchParamsFromColumns: ["country"], // Depends on the 'country' column
    async fetchOptions(query, params) {
      const countryValue = params.country;
      let cities = [];
      // Simulate fetching city data based on the selected country
      if (countryValue === "us") {
        cities = [{ value: "ny", label: "New York" }, { value: "la", label: "Los Angeles" }];
      } else if (countryValue === "ca") {
        cities = [{ value: "to", label: "Toronto" }, { value: "va", label: "Vancouver" }];
      } else if (countryValue === "mx") {
        cities = [{ value: "mc", label: "Mexico City" }, { value: "gua", label: "Guadalajara" }];
      }
      return cities.filter(city => city.label.toLowerCase().includes(query.toLowerCase()));
    }
  },
  {
    key: "age_next_year",
    label: "Age Next Year",
    type: "function",
    // Calculate value based on other cells in the same row
    function: (rowData) => (rowData.age != null) ? rowData.age + 1 : ""
  }
];

 const initialData = [
  {
    name: { value: "1", label: "Leanne Graham" },
    age: 30,
    country: { value: "us", label: "United States" },
    city: { value: "ny", label: "New York" },
    birthdate: "1995-05-15",
  },
  {
    name: { value: "2", label: "Ervin Howell" },
    age: 25,
    country: { value: "ca", label: "Canada" },
    city: { value: "to", label: "Toronto" },
    birthdate: "2000-08-22",
  },
];

 // Function to get all data from the spreadsheet instance
 function handleGetAllData() {
  if (spreadsheetComponent) {
    const allData = spreadsheetComponent.getAllData();
    console.log("All data from the worksheet:", allData);
    alert("Data has been logged to the console. Press F12 to view.");
  }
 }
</script>

<!-- Button to trigger data retrieval -->
<button on:click={handleGetAllData} class="my-4 p-2 bg-blue-500 text-white rounded">
  Get All Spreadsheet Data
</button>

<!-- Render the spreadsheet -->
<Spreadsheet
  bind:this={spreadsheetComponent}
  {columns}
  {initialData}
/>
```

---

## ⚙️ API Reference

### Component Props

| Prop                | Type            | Description                                                                                             |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `columns`           | `Array<Object>` | **Required.** An array of objects defining the structure and behavior of each column.                   |
| `initialData`       | `Array<Object>` | An array of objects representing the initial rows of data for the default worksheet.                    |
| `initialWorksheets` | `Array<Object>` | An array for multi-sheet support. Each object should contain `{ name: string, data: Array<Object> }`.   |
| `rowHeight`         | `number`        | The height of each row in pixels. Defaults to `30`.                                                     |
| `showAddRow`        | `boolean`       | If `true`, displays a button to add new rows. Defaults to `true`.                                       |

### Column Configuration

Each object in the `columns` prop can have the following properties:

| Key                      | Type                                   | Description                                                                                                   |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `key`                    | `string`                               | **Required.** The unique identifier for the column, corresponding to a key in the data objects.               |
| `label`                  | `string`                               | **Required.** The display name for the column header.                                                         |
| `type`                   | `string`                               | The cell type. Can be `'text'`, `'number'`, `'date'`, `'select'`, `'function'`. Defaults to `'text'`.           |
| `width`                  | `string`                               | The CSS width of the column (e.g., `'150px'`).                                                                  |
| `readonly`               | `boolean`                              | If `true`, the cells in this column cannot be edited.                                                         |
| `options`                | `Array`                                | An array of `{ value, label }` objects for `select` type columns.                                             |
| `fetchOptions`           | `async (query, params) => Array`       | An async function for `select` type to fetch options dynamically. `query` is the search term.                 |
| `fetchParamsFromColumns` | `Array<string>`                        | An array of column keys whose values will be passed as the `params` object to `fetchOptions`.                 |
| `onChange`               | `(selected, cell, row, cols) => Array` | A callback for `select` type that triggers when the value changes. Can return an array of updates for other cells. |
| `function`               | `(rowData) => any`                     | A function for `function` type that computes the cell's value based on the current `rowData`.                 |
| `format`                 | `string`                               | A format string (e.g., `'dd/mm/yyyy'`) for `date` type columns.                                               |

### Component Methods

You can call these methods on the component instance obtained via `bind:this`.

| Method         | Parameters | Returns         | Description                                                                    |
| -------------- | ---------- | --------------- | ------------------------------------------------------------------------------ |
| `getAllData()` | `none`     | `Array<Object>` | Returns the complete and current data from all rows in the active worksheet. |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/sciefylab/svelte-spreadsheet/issues).

## 📜 License

This project is [MIT](https://opensource.org/licenses/MIT) licensed.
