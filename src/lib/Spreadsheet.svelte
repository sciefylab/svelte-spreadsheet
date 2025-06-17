<script>
  import Datepicker from './Datepicker.svelte';
  import { tick } from 'svelte';

  let {
    initialData,
    columns,
    initialWorksheets = null,
    rowHeight = 30, // Default row height in pixels
  } = $props();

  let columnWidths = $state(
    columns?.length
      ? columns.map((col) => col.width || "100px")
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => "100px"
        )
  );

  let columnTypes = $state(
    columns?.length
      ? columns.map((col) => col.type || "text")
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => "text"
        )
  );

  let columnOptions = $state(
    columns?.length
      ? columns.map((col) => { // Simplified initialization
          // If it's a select column AND has static options, use them.
          // Otherwise (not select, or select without static options), default to empty array.
          if (col.type === "select" && col.options) {
            return col.options;
          }
          return []; 
        })
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => []
        )
  );

  let columnReadonly = $state(
    columns?.length
      ? columns.map((col) => !!col.readonly) // Convert to boolean
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => false
        )
  );


  let columnFetchOptions = $state(
    columns?.length
      ? columns.map((col) =>
          col.type === "select" && col.fetchOptions 
            ? { fn: col.fetchOptions, paramsFrom: col.fetchParamsFromColumns || [] } 
            : null
        )
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => null
        )
  );

  let dropdownState = $state({
    col: -1,
    row: -1,
    visible: false,
    filteredOptions: [],
    query: "",
    highlightedIndex: -1,
  });

  let optionCache = $state({});
  let justSelected = $state(false);

  let datepickerState = $state({
    row: -1,
    col: -1,
    visible: false,
    position: { top: 0, left: 0 },
  });

  let tempDateState = $state({ row: -1, col: -1, value: "" });

  let cellErrors = $state({});

  let activeBlock = $state({ row: -1, col: -1, block: "dd" });

  function normalizeSelectValue(col, rawValue) {
    if (typeof rawValue === "object" && rawValue?.value && rawValue?.label) {
      return rawValue;
    }
    const value = String(rawValue || "");
    const options = columnOptions[col];
    const option = options.find((opt) => opt.value === value);
    return option || { value, label: value };
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function parseDate(input) {
    if (!input) return null;
    // Regex to match dd/mm/yyyy or d/m/yyyy
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = input.match(regex);
    
    if (!match) return null;

    let [, day, month, year] = match;
    day = parseInt(day);
    month = parseInt(month) - 1;
    year = parseInt(year);
    if (year < 100) { // Basic 2-digit year handling (optional, as regex expects 4-digit year)
      year += year < 50 ? 2000 : 1900;
    }

    const date = new Date(year, month, day);
    if (isNaN(date.getTime()) || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }

    return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parsePartialDate(input, row, col) {
    if (!input) {
      tempDateState = { row, col, value: "" };
      return "";
    }

    const rawParts = input.split("/"); // e.g., ["1_", "__", "____"]
    const cleanedParts = rawParts.map(p => p.replace(/_/g, "")); // e.g., ["1", "", ""]

    const currentDate = new Date();
    let dInt = parseInt(cleanedParts[0]);
    let mInt = parseInt(cleanedParts[1]);
    let yInt = parseInt(cleanedParts[2]);

    // Use current date parts if not available or not valid numbers
    const currentDay = currentDate.getDate();
    const currentMonth = currentDate.getMonth() + 1; // 1-based
    const currentFullYear = currentDate.getFullYear();

    if (isNaN(dInt)) dInt = currentDay;
    if (isNaN(mInt)) mInt = currentMonth;
    
    if (isNaN(yInt)) {
        yInt = currentFullYear;
    } else {
        if (yInt >= 0 && yInt <= 99) { // Handle 2-digit year
            yInt = yInt < 50 ? 2000 + yInt : 1900 + yInt;
        } else if (yInt < 1000) { // Invalid 3-digit year, default to current
            yInt = currentFullYear;
        }
        // 4-digit years are used as is
    }

    // Basic range validation for what we have so far
    dInt = Math.min(31, Math.max(1, dInt)); // Clamp day
    mInt = Math.min(12, Math.max(1, mInt)); // Clamp month
    // yInt is assumed to be plausible now

    // Construct a date object to validate day against month/year (e.g., Feb 30)
    const testDate = new Date(yInt, mInt - 1, dInt); // mInt-1 for 0-indexed month

    if (isNaN(testDate.getTime()) || testDate.getFullYear() !== yInt || testDate.getMonth() !== (mInt - 1) || testDate.getDate() !== dInt) {
      // If the date is invalid (e.g., Feb 30 resulted in Mar 2), or parts were adjusted by Date constructor.
      // For tempDateState, this indicates the user's partial input is currently impossible to form a valid date.
      tempDateState = { row, col, value: "" };
      return "";
    }

    const result = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, "0")}-${String(testDate.getDate()).padStart(2, "0")}`;
    tempDateState = { row, col, value: result };
    return result;
  }

  function normalizeDateValue(rawValue) {
    if (!rawValue) return "";
    const date = new Date(rawValue + "T00:00:00");
    if (isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatNumberWithSeparators(numStr) {
    if (numStr === null || numStr === undefined || String(numStr).trim() === "") return "";
    
    // Attempt to convert to a canonical number string first
    let canonicalValueStr;
    const num = parseFloat(String(numStr)); // Convert to number, then back to string for canonical form

    if (isNaN(num)) {
        // If not a valid number after attempting parseFloat, return the original string.
        // This handles cases where numStr might be non-numeric text that shouldn't be formatted.
        return String(numStr); 
    }
    canonicalValueStr = String(num); // e.g., "0" from "0000" or 0, "7" from "007"

    // Now use canonicalValueStr for formatting
    const parts = canonicalValueStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : null;

    const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart !== null ? formattedIntegerPart + "." + decimalPart : formattedIntegerPart;
  }

  function validateDatePart(part, type) {
    if (part.includes("_")) return true;
    const num = parseInt(part);
    if (type === "day") return num >= 1 && num <= 31;
    if (type === "month") return num >= 1 && num <= 12;
    if (type === "year") return num >= 1000 && num <= 9999;
    return true;
  }

  function createGridFromData(data, columns) {
    if (!data?.length || !columns?.length) {
      return Array.from({ length: 10 }, () =>
        Array.from({ length: columns?.length || 10 }, () => ({ value: "" }))
      );
    }
    const grid = [];
    for (const row of data) {
      const gridRow = [];
      for (const [colIndex, col] of columns.entries()) {
        const value = row[col.key];
        if (col.type === "select") {
          gridRow.push({ value: normalizeSelectValue(colIndex, value) });
        } else if (col.type === "date") {
          gridRow.push({ value: normalizeDateValue(value) });
        } else if (col.type === "number") {
          let finalValue = "";
          if (value !== null && value !== undefined) {
            // Bersihkan pemisah ribuan dari data awal
            const sValue = String(value).replace(/,/g, '').trim();
            if (sValue !== "") {
              const num = parseFloat(sValue);
              if (!isNaN(num)) {
                finalValue = String(num); // Simpan bentuk kanonik, misal "007" -> "7"
              } else {
                // Jika data awal untuk kolom angka tidak valid, simpan sebagai string kosong
                finalValue = ""; 
              }
            }
          }
          gridRow.push({ value: finalValue });
        } else if (col.type === "function" && typeof col.function === 'function') {
          const funcResult = col.function(row);
          gridRow.push({ value: String(funcResult == null ? "" : funcResult) });
        } else {
          gridRow.push({ value: String(value || "") });
        }
      }
      grid.push(gridRow);
    }
    return grid;
  }

  // Initialize worksheets as an empty array; $effect will populate it.
  let worksheets = $state([]);
  let focusedCell = $state({ row: -1, col: -1 });

  $effect(() => {
    // This effect is for initial data loading or when initialData/columns props change.
    let gridToUse;
    const defaultGrid = () => Array.from({ length: 10 }, () =>
      Array.from({ length: columns?.length || 10 }, () => ({ value: "" }))
    );

    if (initialData && columns) {
      gridToUse = createGridFromData(initialData, columns);
    } else if (initialWorksheets && initialWorksheets.length > 0 && initialWorksheets[0] && initialWorksheets[0].grid) {
      gridToUse = initialWorksheets[0].grid;
    } else {
      gridToUse = defaultGrid();
    }
    // Always ensure worksheets is an array with a single sheet object
    worksheets = [{ name: "Sheet1", grid: gridToUse }];
  });

  // Helper to build a key-value object for the current row data
  function buildRowDataObject(gridRow, allColumnsConfig) {
    const rowData = {};
    if (!allColumnsConfig || !gridRow) return rowData;

    allColumnsConfig.forEach((colDef, index) => {
      if (colDef.key && gridRow[index]) {
        let cellVal = gridRow[index].value;

        // For select type, extract the actual value if it's an object {value, label}
        if (colDef.type === 'select' && typeof cellVal === 'object' && cellVal !== null && cellVal.hasOwnProperty('value')) {
          cellVal = cellVal.value;
        }

        // Convert to appropriate type for rowData consumers (functions, onChange)
        if (colDef.type === 'number') {
          const num = parseFloat(cellVal); // cellVal from grid is usually a string
          rowData[colDef.key] = isNaN(num) ? null : num;
        } else if (colDef.type === 'date') {
          // Dates are "YYYY-MM-DD" strings in the grid, which is fine for rowData.
          rowData[colDef.key] = cellVal;
        } else {
          // For 'text', 'function' types (output is string), and 'select' (where cellVal is already the extracted option value).
          rowData[colDef.key] = cellVal;
        }
      }
    });
    return rowData;
  }

  function evaluateAllFunctionCellsInRow(rowIndex, currentGrid, allColumnsConfig) {
    if (!currentGrid || !currentGrid[rowIndex] || !allColumnsConfig) return false;

    const rowCells = currentGrid[rowIndex];
    // buildRowDataObject uses the current state of rowCells.
    // If function columns depend on other function columns in the same row,
    // this ensures they use values from the beginning of this evaluation pass for the row.
    const rowDataForFunctions = buildRowDataObject(rowCells, allColumnsConfig);
    let changedInRow = false;

    allColumnsConfig.forEach((colDef, colIndex) => {
      if (colDef.type === "function" && typeof colDef.function === 'function') {
        if (rowCells && rowCells[colIndex]) {
          const newValue = String(colDef.function(rowDataForFunctions) ?? "");
          if (rowCells[colIndex].value !== newValue) {
            rowCells[colIndex].value = newValue;
            changedInRow = true;
          }
        }
      }
    });
    return changedInRow;
  }

  let activeSheet = $derived(worksheets[0]); // Always refers to the first (only) sheet

  function toggleDatepicker(row, col, event) {
    const input = event.target;
    const rect = input.getBoundingClientRect();
    if (columnReadonly[col]) return; // Prevent opening datepicker for readonly columns

    const cellCurrentValue = worksheets[0].grid[row][col].value; // YYYY-MM-DD or ""

    // Determine if the datepicker is currently visible for this specific cell    
    const isCurrentlyVisibleForThisCell = datepickerState.visible && datepickerState.row === row && datepickerState.col === col;
    // If it's not visible for this cell, we should open it. If it is, toggle means close it.
    const shouldOpen = !isCurrentlyVisibleForThisCell;

    datepickerState = {
      row,
      col,
      visible: shouldOpen,
      position: { top: rect.bottom + window.scrollY, left: Math.max(5, rect.left + window.scrollX) },
    };

    if (shouldOpen) {
      focusedCell = { row, col }; // Ensure focusedCell is updated
      activeBlock = { row, col, block: "dd" }; // Always start editing from the day part
      tempDateState = { row, col, value: cellCurrentValue }; // Store the original YYYY-MM-DD value

      if (cellCurrentValue) { // If there's an existing date in the grid
        input.value = formatDate(cellCurrentValue); // Display it formatted as dd/mm/yyyy
      } else { // If the cell is empty in the grid
        input.value = "__/__/____"; // Display the placeholder
      }
      input.dataset.tempValue = input.value; // Initialize tempValue for handleDateKeydown
      // Select the 'dd' part (first two characters)
      setTimeout(() => {
        // Ensure the input is still the active element before trying to set selection
        if (document.activeElement === input) {
          input.setSelectionRange(0, 2);
        }
      }, 0);
    } else { // Datepicker is being closed for this cell (e.g., by clicking the input again)
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };
    }
  }

  function handleDateSelect(row, col, date) {
    worksheets[0].grid[row][col].value = date || "";
    evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
    worksheets = [...worksheets];
    datepickerState = { ...datepickerState, visible: false };
    tempDateState = { row: -1, col: -1, value: "" };
    activeBlock = { row: -1, col: -1, block: "dd" };

    // Ensure the input's tempValue is cleared after selection from datepicker
    const input = document.querySelector(`#cell-${row}-${col}`);
    if (input) {
        input.dataset.tempValue = ""; // Clear any temporary manual input
    }
  }

  async function filterOptions(row, col, query) {
    if (columnReadonly[col]) return; // Prevent filtering for readonly columns

    const fetchConfig = columnFetchOptions[col];
    let options = [];
    // Optional: for displaying errors in dropdown, you could add a state here
    // let currentErrorMessage = ""; 

    if (fetchConfig && fetchConfig.fn) {
      const fetchFn = fetchConfig.fn;
      const paramsFrom = fetchConfig.paramsFrom;
      let additionalParams = {};
      let cacheKeyParts = [col, query];

      if (paramsFrom.length > 0) {
        for (const paramKey of paramsFrom) {
          // Find the column index for this paramKey
          const paramColIndex = columns.findIndex(c => c.key === paramKey);
          if (paramColIndex !== -1 && worksheets[0].grid[row] && worksheets[0].grid[row][paramColIndex]) {
            const cellValue = worksheets[0].grid[row][paramColIndex].value;
            // Handle select objects vs. plain values
            additionalParams[paramKey] = typeof cellValue === 'object' && cellValue !== null ? cellValue.value : cellValue;
            cacheKeyParts.push(`${paramKey}:${additionalParams[paramKey]}`);
          }
        }
      }
      const cacheKey = cacheKeyParts.join('-');

      if (optionCache[cacheKey]) {
        options = optionCache[cacheKey];
      } else {
        try {
          options = await fetchFn(query, additionalParams); // Pass additionalParams
          optionCache[cacheKey] = options;
          optionCache = { ...optionCache };
        } catch (error) {
          console.error(`Error fetching options for col ${col}, query "${query}":`, error);
          // currentErrorMessage = "Error fetching options";
          options = []; // Default to empty on error
        }
      }
    } else {
      // Ensure columnOptions[col] is actually an array before filtering
      if (Array.isArray(columnOptions[col])) {
        options = columnOptions[col].filter((opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase())
        );
      } else {
        console.error(`columnOptions[${col}] is not an array:`, columnOptions[col]);
        // currentErrorMessage = "Configuration error for options";
        options = []; // Default to empty if columnOptions is malformed
      }
    }
    dropdownState = { 
      ...dropdownState, 
      filteredOptions: options, 
      row, // Ensure row/col from input context are used
      col, 
      highlightedIndex: -1,
      // fetchError: currentErrorMessage // Optional: if you want to display fetch errors
    };
    updateDropdownPosition(row, col);
  }

  async function selectOption(row, col, option) {
    if (columnReadonly[col]) return; // Prevent selecting for readonly columns

    worksheets[0].grid[row][col].value = {
      value: option.value,
      label: option.label,
    };
    worksheets = [...worksheets];

    // Handle onChange event for the column, if defined
    const columnDef = columns[col];
    if (columnDef && typeof columnDef.onChange === 'function') {
      const currentGridRowCells = worksheets[0].grid[row];
      const fullRowDataObject = buildRowDataObject(currentGridRowCells, columns);

      const updatesToApply = columnDef.onChange(
        option, // The selected option {value, label}
        worksheets[0].grid[row][col], // The current cell object {value: ...} that just changed
        fullRowDataObject, // The current row data as an object {colKey: value, ...}
        columns // All column definitions
      );

      if (Array.isArray(updatesToApply)) {
        updatesToApply.forEach(update => {
          const targetColIndex = columns.findIndex(c => c.key === update.targetColumnKey);
          if (targetColIndex !== -1 && targetColIndex < currentGridRowCells.length) {
            if (columnReadonly[targetColIndex]) {
              console.warn(`Spreadsheet: onChange triggered for column '${columnDef.key}', but target column '${update.targetColumnKey}' is read-only. Skipping update.`);
              return; // Skip this update if target is readonly
            }

            let valueToSet = update.value;
            const targetColType = columnTypes[targetColIndex];

            if (targetColType === 'select') {
              worksheets[0].grid[row][targetColIndex].value = normalizeSelectValue(targetColIndex, valueToSet);
            } else if (targetColType === 'date') {
              worksheets[0].grid[row][targetColIndex].value = normalizeDateValue(valueToSet);
            } else if (targetColType === 'number') {
              const numValue = parseFloat(valueToSet);
              worksheets[0].grid[row][targetColIndex].value = isNaN(numValue) ? "" : String(numValue);
            } else { // Default to text
              worksheets[0].grid[row][targetColIndex].value = String(valueToSet == null ? "" : valueToSet);
            }
          }
        });
      }
    }

    evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
    // worksheets = [...worksheets]; // This will be called after this block by the original logic
    dropdownState = { col: -1, row: -1, visible: false, filteredOptions: [], query: "", highlightedIndex: -1 };
    justSelected = true;

    // Wait for Svelte to process DOM updates based on state changes
    await tick();

    const input = document.querySelector(`#cell-${row}-${col}`);
    if (input) {
      // Manually set the input value. This ensures the display is correct,
      // especially if Svelte didn't update the DOM for an identical string value.
      // This will trigger the oninput event.
      input.value = option.label; 
      input.focus();
    }

    // After a short delay, reset justSelected.
    // The focus might have already been set, but this ensures it if input was found.
    setTimeout(() => {
      justSelected = false;
      // Re-focus if necessary, though typically covered by the focus after tick()
      if (input && document.activeElement !== input) {
        input.focus();
      }
    }, 16); // Small delay for resetting justSelected
  }

  function handleInput(row, col, event) {
    const input = event.target;
    let value = input.value;
    if (columnReadonly[col]) return; // Prevent input for readonly columns

    if (columnTypes[col] === "number") {
      const rawValueFromInput = input.value;
      const cleanedValue = rawValueFromInput.replace(/,/g, ''); // Hapus pemisah ribuan untuk diproses

      // Regex untuk memvalidasi input numerik parsial (membolehkan "", "-", "00", "1.", ".5")
      const simpleNumericRegex = /^-?\d*\.?\d*$/;

      if (simpleNumericRegex.test(cleanedValue)) {
        // Simpan nilai yang dibersihkan (misalnya "00000", "1.", "-") langsung ke grid.
        // Ini memungkinkan input field menampilkan apa yang diketik pengguna secara akurat.
        if (worksheets[0].grid[row][col].value !== cleanedValue) {
          worksheets[0].grid[row][col].value = cleanedValue;
          worksheets = [...worksheets]; // Update grid dan picu reaktivitas Svelte
        }
        // Hapus error sebelumnya jika input menjadi valid
        if (cellErrors[`${row}-${col}`]) {
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }
      } else {
        // Input tidak dalam format numerik yang valid (misalnya, mengandung huruf)
        cellErrors[`${row}-${col}`] = "Input harus berupa angka.";
        setTimeout(() => {
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
        // Jangan update worksheets[0].grid[row][col].value dengan input yang tidak valid.
        // Input field di DOM akan menampilkan karakter tidak valid,
        // namun prop `value` Svelte untuk input akan tetap menggunakan nilai grid lama.
        // Ini bisa menyebabkan ketidaksesuaian visual; pengguna harus mengoreksi input.
      }
      // `evaluateAllFunctionCellsInRow` sebaiknya dipanggil di `onblur` untuk kolom angka,
      // untuk memastikan fungsi dievaluasi dengan nilai kanonik final, bukan nilai parsial
      // seperti "00" atau "1.".
      // Jika Anda tetap ingin evaluasi live, pindahkan ke dalam blok `if (isValidNumericInput)`
      // dan pastikan fungsi Anda bisa menangani nilai non-kanonik jika perlu.
      // Untuk saat ini, kita akan menundanya ke onblur.
      // evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      // worksheets = [...worksheets]; // Sudah dipanggil di atas jika ada perubahan valid

    } else if (columnTypes[col] === "date") {
      // Sync dataset.tempValue with the current input value
      input.dataset.tempValue = value;
      // Update the underlying YYYY-MM-DD temporary state
      parsePartialDate(value, row, col);

      // Validation for allowed characters
      if (value && !/^[0-9/_]*$/.test(value)) {
        input.style.border = "1px solid red";
        cellErrors[`${row}-${col}`] = "Gunakan angka dan / saja (dd/mm/yyyy)";
        setTimeout(() => {
          if (input) input.style.border = "";
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
        return; // Stop further processing if invalid characters
      }

      // Validation for date parts (e.g., day 01-31)
      // This should run on the current 'value' which is like "dd/mm/yyyy" with underscores
      const tempValueForValidation = value;
      if (tempValueForValidation.replace(/_/g, "").length >= 8) { // Check if all parts seem filled
        const parts = tempValueForValidation.split("/");
        if (
          !validateDatePart(parts[0], "day") ||
          !validateDatePart(parts[1], "month") ||
          !validateDatePart(parts[2], "year")
        ) {
          input.style.border = "1px solid red";
          cellErrors[`${row}-${col}`] = "Tanggal tidak valid (dd: 01-31, mm: 01-12, yyyy: 1000-9999)";
          setTimeout(() => {
            if (input) input.style.border = "";
            cellErrors[`${row}-${col}`] = "";
            cellErrors = { ...cellErrors };
          }, 2000);
          return;
        }
      }
    } else if (columnTypes[col] === "select") {
      if (justSelected) {
        // An option was just programmatically selected and input.value was set.
        // This triggered oninput. selectOption has already hidden the dropdown.
        // We update the query part of dropdownState but keep it hidden
        // and avoid re-filtering, as the selection process is complete.
        dropdownState = { 
          ...dropdownState, 
          query: value, // `value` here is option.label
          highlightedIndex: -1 // Reset highlight as dropdown is not meant to be open
        };
        return; 
      }
      // Existing select handling logic
      dropdownState = { ...dropdownState, query: value, row, col, visible: true, filteredOptions: [], highlightedIndex: -1 };
      filterOptions(row, col, value);
    } else {
      // Existing text handling logic
      // Also handles function columns if they were not readonly (but they should be)
      worksheets[0].grid[row][col].value = value;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
    }
  }

  function handleDateKeydown(event, row, col) {
    if (columnReadonly[col]) return; // Prevent keydown for readonly columns
    if (columnTypes[col] !== "date") return;
    const input = event.target;
    // tempValue should strictly be from dataset, which is managed for the mask editing session.
    // toggleDatepicker ensures input.dataset.tempValue is initialized with the mask.
    let tempValue = input.dataset.tempValue;

    // If tempValue is not a string (e.g., undefined if something went wrong), treat as uninitialized.
    if (typeof tempValue !== 'string') tempValue = "__/__/____"; 
    const currentValue = worksheets[0].grid[row][col].value;

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const parsedValue = parseDate(tempValue.replace(/_/g, ""));
      const allPartsFilled = tempValue.split('/').every(part => !part.includes("_") && part.length > 0);

      if (allPartsFilled && !parsedValue) {
        input.style.border = "1px solid red";
        cellErrors[`${row}-${col}`] = "Tanggal tidak valid. Gunakan dd/mm/yyyy";
        setTimeout(() => {
          if (!input) return; // Check if input still exists
          input.style.border = "";
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
        input.value = formatDate(currentValue);
        return;
      }
      // If parsedValue is null (incomplete or invalid input), revert to currentValue.
      // Otherwise, use parsedValue. If currentValue was empty and parsedValue is null, it becomes empty.
      const valueToCommit = parsedValue !== null ? parsedValue : currentValue || "";
      worksheets[0].grid[row][col].value = valueToCommit;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
      if (input) {
        // Display the committed value, formatted.
        input.value = formatDate(valueToCommit);
        // Clear tempValue as editing session for this cell is ending.
        input.dataset.tempValue = ""; 
      }
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };
      datepickerState = { ...datepickerState, visible: false };
    } else if (event.key === "Escape" && input) {
      event.preventDefault();
      input.value = formatDate(currentValue);
      input.dataset.tempValue = "";
      // No grid data change, so no need to re-evaluate functions or spread worksheets
      datepickerState = { ...datepickerState, visible: false };
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };
    } else if (event.key === "/") {
      event.preventDefault(); // Always prevent default for '/'
      const parts = tempValue.split("/");
      if (activeBlock.block === "dd" && parts[0]?.length === 2 && !parts[0].includes("_")) {
        input.value = `${parts[0]}/__`;
        input.dataset.tempValue = input.value;
        activeBlock = { row, col, block: "mm" };
        setTimeout(() => input.setSelectionRange(3, 3), 0);
        parsePartialDate(input.value, row, col);
      } else if (activeBlock.block === "mm" && parts[1]?.length === 2 && !parts[1].includes("_")) {
        input.value = `${parts[0]}/${parts[1]}/____`;
        input.dataset.tempValue = input.value;
        activeBlock = { row, col, block: "yyyy" };
        setTimeout(() => input.setSelectionRange(6, 6), 0);
        parsePartialDate(input.value, row, col);
      }
    } else if (/[0-9]/.test(event.key)) {
      event.preventDefault();
      const parts = tempValue.split("/");
      let dayValue = parts[0] || "__";
      let monthValue = parts[1] || "__";
      let yearValue = parts[2] || "____";

      let newCursorPos = input.selectionStart;
      let newBlock = activeBlock.block;

      if (activeBlock.block === "dd") {
        let currentDayChars = dayValue.replace(/_/g, "");
        let dayCharsToBuild;
        // If "dd" part is selected (cursor 0 to 2) and has content, new key starts the day.
        if (input.selectionStart === 0 && input.selectionEnd === 2 && currentDayChars.length > 0) {
          dayCharsToBuild = event.key;
        } else { // Append to existing or empty day part.
          dayCharsToBuild = (currentDayChars + event.key);
        }
        let newDayChars = dayCharsToBuild.slice(0, 2);
        dayValue = newDayChars.padEnd(2, "_");
        newCursorPos = newDayChars.length;
        if (newDayChars.length === 2 && dayCharsToBuild.length <= 2) { // Move to month if day is complete
          // Select the "mm" part
          newBlock = "mm";
          setTimeout(() => input.setSelectionRange(3, 5), 0); // Select __ for month
        }
      } else if (activeBlock.block === "mm") {
        // No change to newCursorPos here, it's handled by the selection below or end of block
        let currentMonthChars = monthValue.replace(/_/g, "");
        let monthCharsToBuild;
        // If "mm" part is selected (cursor 3 to 5) and has content, new key starts the month.
        if (input.selectionStart === 3 && input.selectionEnd === 5 && currentMonthChars.length > 0) {
          monthCharsToBuild = event.key;
        } else { // Append to existing or empty month part.
          monthCharsToBuild = (currentMonthChars + event.key);
        }
        let newMonthChars = monthCharsToBuild.slice(0, 2);
        monthValue = newMonthChars.padEnd(2, "_");
        newCursorPos = 3 + newMonthChars.length;
        if (newMonthChars.length === 2 && monthCharsToBuild.length <= 2) { // Move to year if month is complete
          // Select the "yyyy" part
          newBlock = "yyyy";
          setTimeout(() => input.setSelectionRange(6, 10), 0); // Select ____ for year
        }
      } else if (activeBlock.block === "yyyy") {
        // No change to newCursorPos here, it's handled by the selection below or end of block
        let currentYearChars = yearValue.replace(/_/g, "");
        let yearCharsToBuild;
        // If "yyyy" part is selected (cursor 6 to 10) and has content, new key starts the year.
        if (input.selectionStart === 6 && input.selectionEnd === 10 && currentYearChars.length > 0) {
          yearCharsToBuild = event.key;
        } else { // Append to existing or empty year part.
          yearCharsToBuild = (currentYearChars + event.key);
        }
        let newYearChars = yearCharsToBuild.slice(0, 4);
        yearValue = newYearChars.padEnd(4, "_");
        newCursorPos = 6 + newYearChars.length;
      }

      const newValue = `${dayValue}/${monthValue}/${yearValue}`;
      input.value = newValue;
      input.dataset.tempValue = newValue;

      const originalBlock = activeBlock.block; // Simpan blok sebelum pembaruan
      activeBlock = { row, col, block: newBlock }; // Perbarui activeBlock

      // Hanya atur kursor jika blok tidak berubah (transisi blok sudah diurus oleh setTimeout spesifik)
      if (newBlock === originalBlock) {
        setTimeout(() => input.setSelectionRange(newCursorPos, newCursorPos), 0);
      }
      parsePartialDate(newValue, row, col);

    } else if (event.key === "Backspace") {
      event.preventDefault();
      const parts = tempValue.split("/");
      let day = parts[0] || "__";
      let month = parts[1] || "__";
      let year = parts[2] || "____";
      
      let newCursorPos = input.selectionStart;
      let newBlock = activeBlock.block;

      if (activeBlock.block === "mm" && input.selectionStart <= 3) {
        // Transisi dari MM ke DD: hapus karakter terakhir DD
        newBlock = "dd";
        let dayChars = day.replace(/_/g, "");
        if (dayChars.length > 0) { dayChars = dayChars.slice(0, -1); }
        day = dayChars.padEnd(2, "_");
        month = "__"; // Reset bulan
        year = "____"; // Reset tahun
        newCursorPos = dayChars.length;
      } else if (activeBlock.block === "yyyy" && input.selectionStart <= 6) {
        // Transisi dari YYYY ke MM: hapus karakter terakhir MM
        newBlock = "mm";
        let monthChars = month.replace(/_/g, "");
        if (monthChars.length > 0) { monthChars = monthChars.slice(0, -1); }
        month = monthChars.padEnd(2, "_");
        year = "____"; // Reset tahun
        newCursorPos = 3 + monthChars.length;
      } else if (activeBlock.block === "dd") {
        let dayChars = day.replace(/_/g, "");
        if (dayChars.length > 0) { dayChars = dayChars.slice(0, -1); }
        day = dayChars.padEnd(2, "_");
        newCursorPos = dayChars.length;
      } else if (activeBlock.block === "mm") {
        let monthChars = month.replace(/_/g, "");
        if (monthChars.length > 0) { monthChars = monthChars.slice(0, -1); }
        month = monthChars.padEnd(2, "_");
        newCursorPos = 3 + monthChars.length;
      } else if (activeBlock.block === "yyyy") {
        let yearChars = year.replace(/_/g, "");
        if (yearChars.length > 0) { yearChars = yearChars.slice(0, -1); }
        year = yearChars.padEnd(4, "_");
        newCursorPos = 6 + yearChars.length;
      }

      const newValue = `${day}/${month}/${year}`;
      input.value = newValue;
      input.dataset.tempValue = newValue;
      activeBlock = { row, col, block: newBlock };
      setTimeout(() => input.setSelectionRange(newCursorPos, newCursorPos), 0);
      parsePartialDate(newValue, row, col);
    }
  }

  function handleDateBlur(row, col, event) {
    if (columnReadonly[col]) return; // Prevent blur processing for readonly columns
    if (columnTypes[col] !== "date") return;
    const input = event.target;
    const tempValue = input.dataset.tempValue || input.value;
    const parsedValue = parseDate(tempValue.replace(/_/g, "")); // Use tempValue for parsing
    const currentValue = worksheets[0].grid[row][col].value; // Grid's current value for fallback

    if (tempValue.replace(/_/g, "").length >= 8 && !parsedValue) {
      input.style.border = "1px solid red";
      cellErrors[`${row}-${col}`] = "Tanggal tidak valid. Gunakan dd/mm/yyyy";
      setTimeout(() => {
        input.style.border = "";
        cellErrors[`${row}-${col}`] = "";
        cellErrors = { ...cellErrors };
      }, 2000);
      input.value = formatDate(currentValue);
    } else {
      // If parsedValue is null (incomplete or invalid input), revert to currentValue.
      // Otherwise, use parsedValue. If currentValue was empty and parsedValue is null, it becomes empty.
      const valueToCommit = parsedValue !== null ? parsedValue : currentValue || "";
      worksheets[0].grid[row][col].value = valueToCommit;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
      input.value = formatDate(valueToCommit); // Display the committed value
    }
    input.dataset.tempValue = ""; // Clear tempValue as editing session is ending
    tempDateState = { row: -1, col: -1, value: "" };
    activeBlock = { row: -1, col: -1, block: "dd" };
  }

  function handleBlurForNumber(row, col, event) {
    if (columnReadonly[col]) return;
    const input = event.target;
    let value = input.value.replace(/,/g, ''); // Bersihkan nilai dari input
    let gridValueChanged = false;

    if (value === "" || value === "-") { // Jika kosong atau hanya tanda minus
      // Jika di blur nilainya "-", anggap sebagai string kosong.
      const finalValue = ""; 
      if (worksheets[0].grid[row][col].value !== finalValue) {
        worksheets[0].grid[row][col].value = "";
        gridValueChanged = true;
        // evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
        // worksheets = [...worksheets];
      }
    } else {
      const parsedNumber = parseFloat(value);
      if (isNaN(parsedNumber)) {
        // Jika input tidak valid saat blur, nilai grid tidak diubah.
        // Input akan menampilkan nilai grid lama yang diformat saat isFocused menjadi false.
        cellErrors[`${row}-${col}`] = "Angka tidak valid, nilai dikembalikan.";
        setTimeout(() => {
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
      } else {
        const newRawValue = String(parsedNumber);
        if (worksheets[0].grid[row][col].value !== newRawValue) {
          worksheets[0].grid[row][col].value = newRawValue;
          gridValueChanged = true;
          // evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
          // worksheets = [...worksheets];
        }
      }
    }
    // Selalu evaluasi fungsi dan picu reaktivitas pada blur untuk kolom angka
    // untuk memastikan konsistensi data dan pembaruan UI.
    const functionsChanged = evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
    if (gridValueChanged || functionsChanged) {
      worksheets = [...worksheets];
    }
  }
  function handleDropdownKeydown(event, row, col) {
    if (columnReadonly[col]) return; // Prevent keydown for readonly columns
    if (columnTypes[col] !== "select" || !dropdownState.visible) return;
    const { filteredOptions, highlightedIndex } = dropdownState;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const newIndex = Math.min(filteredOptions.length - 1, highlightedIndex + 1);
      dropdownState = { ...dropdownState, highlightedIndex: newIndex };
      // Scroll the highlighted option into view
      if (newIndex >= 0 && newIndex < filteredOptions.length) {
        const optionElement = document.querySelector(`#option-${row}-${col}-${newIndex}`);
        if (optionElement) {
          optionElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const newIndex = Math.max(-1, highlightedIndex - 1);
      dropdownState = { ...dropdownState, highlightedIndex: newIndex };
      // Scroll the highlighted option into view
      // Check newIndex >= 0 because -1 means no selection, no specific element to scroll to.
      if (newIndex >= 0 && newIndex < filteredOptions.length) {
        const optionElement = document.querySelector(`#option-${row}-${col}-${newIndex}`);
        if (optionElement) {
          optionElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      // Ensure highlightedIndex is valid and within bounds
      if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(row, col, filteredOptions[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      dropdownState = { ...dropdownState, visible: false, highlightedIndex: -1 };
    }
  }

  function updateDropdownPosition(row, col) {
    const input = document.querySelector(`#cell-${row}-${col}`);
    const dropdown = document.querySelector(`.dropdown`);
    if (input && dropdown && dropdownState.visible) {
      const inputRect = input.getBoundingClientRect(); // Coordinates of the input relative to the viewport
      
      // For position:fixed, top/left are relative to the viewport.
      // inputRect.bottom is the bottom edge of the input relative to the viewport.
      // inputRect.left is the left edge of the input relative to the viewport.
      dropdown.style.top = `${inputRect.bottom}px`;
      dropdown.style.left = `${inputRect.left}px`;
      
      const minDropdownWidth = 180; // Lebar minimum untuk dropdown dalam piksel
      dropdown.style.width = `${Math.max(inputRect.width, minDropdownWidth)}px`;
    }
  }

  $effect(() => {
    if (dropdownState.visible) {
      const update = () => updateDropdownPosition(dropdownState.row, dropdownState.col);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update);
      update(); // Call immediately when dropdown becomes visible or its context changes
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update);
      };
    }
  });

  function handleOutsideClick(event) {
    if (datepickerState.visible) {
      const datepicker = document.querySelector(".spreadsheet-datepicker-popup-runes");
      const input = document.querySelector(`#cell-${datepickerState.row}-${datepickerState.col}`);
      if (datepicker && input && !datepicker.contains(event.target) && !input.contains(event.target)) {
        datepickerState = { ...datepickerState, visible: false };
        tempDateState = { row: -1, col: -1, value: "" };
        activeBlock = { row: -1, col: -1, block: "dd" };
      }
    }
    if (dropdownState.visible) {
      // Check if the click is outside the dropdown and its trigger input
      const dropdownElement = document.querySelector('.dropdown'); // Assumes one active dropdown
      const triggerInput = document.querySelector(`#cell-${dropdownState.row}-${dropdownState.col}`);
      if (dropdownElement && triggerInput &&
          !dropdownElement.contains(event.target) &&
          !triggerInput.contains(event.target)) {
        dropdownState = { ...dropdownState, visible: false, highlightedIndex: -1 };
      }
    }
  }

  function handleKeydown(event) {
    if (dropdownState.visible || justSelected || datepickerState.visible) return;

    const { row, col } = focusedCell;
    const maxRows = worksheets[0].grid.length;
    const maxCols = worksheets[0].grid[0].length;

    let newRow = row;
    let newCol = col;

    switch (event.key) {
      case "ArrowUp":
        newRow = Math.max(0, row - 1);
        event.preventDefault();
        break;
      case "ArrowDown":
        newRow = Math.min(maxRows - 1, row + 1);
        event.preventDefault();
        break;
      case "ArrowLeft":
        newCol = Math.max(0, col - 1);
        event.preventDefault();
        break;
      case "ArrowRight":
        newCol = Math.min(maxCols - 1, col + 1);
        event.preventDefault();
        break;
      case "Enter":
        newRow = Math.min(maxRows - 1, row + 1);
        event.preventDefault();
        break;
      case "Tab":
        event.preventDefault();
        if (event.shiftKey) {
          if (col > 0) newCol--;
          else if (row > 0) { newRow--; newCol = maxCols - 1; }
        } else {
          if (col < maxCols - 1) newCol++;
          else if (row < maxRows - 1) { newRow++; newCol = 0; }
        }
        break;
    }

    if (newRow !== row || newCol !== col) {
      // Update focusedCell here, once, based on the final newRow and newCol
      focusedCell = { row: newRow, col: newCol };
      dropdownState = { col: -1, row: -1, visible: false, filteredOptions: [], query: "", highlightedIndex: -1 };

      // Close datepicker if it was visible for a *different* cell than the new one
      if (datepickerState.visible && (datepickerState.row !== newRow || datepickerState.col !== newCol)) {
          datepickerState = { ...datepickerState, visible: false };
      }
      
      // Reset temporary date states as we are moving to a new cell
      datepickerState = { ...datepickerState, visible: false };
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };

      setTimeout(() => {
        const inputElement = document.querySelector(`#cell-${newRow}-${newCol}`);
        if (inputElement) {
          inputElement.focus(); // This will trigger the 'onfocus' handler for the input.
                               // For date cells, 'onfocus' calls toggleDatepicker, which now correctly
                               // sets the input value (existing date or placeholder) and selection.
          if (columnTypes[newCol] === "date") {
            // toggleDatepicker (called by onfocus) handles value and selection
          } else {
            inputElement.select(); // For non-date cells, select the content.
          }
        }
      }, 0);
    }
  }

  let isDragging = $state(false);
  let dragStart = $state(null);
  let dragEnd = $state(null);

  function startDrag(event, row, col) {
    if (columnReadonly[col]) return; // Prevent dragging from readonly columns
    event.preventDefault();
    isDragging = true;
    dragStart = { row, col };
    dragEnd = { row, col };
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function handleDrag(event) {
    if (!isDragging) return;
    const table = document.querySelector("#spreadsheet-table");
    const cells = table.querySelectorAll("td");
    let targetCell;

    for (const cell of cells) {
      const rect = cell.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        targetCell = cell;
        break;
      }
    }

    if (targetCell) {
      const row = parseInt(targetCell.dataset.row);
      const col = parseInt(targetCell.dataset.col);
      dragEnd = { row, col };
    }
  }

  async function stopDrag() {
    if (!isDragging) return;
    isDragging = false;

    if (dragStart && dragEnd) {
      const { row: startRow, col: startCol } = dragStart;
      const { row: endRow, col: endCol } = dragEnd;
      const sourceType = columnTypes[startCol];
      const sourceValue = worksheets[0].grid[startRow][startCol].value;

      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);

      let allowCopy = true; // Assume copy is allowed initially

      // Check if all target columns are of the same type as the source column
      for (let j = minCol; j <= maxCol; j++) {
        if (columnTypes[j] !== sourceType) {
          allowCopy = false;
          break;
        }
        // Also check if any target column is readonly
        if (columnReadonly[j] || columnTypes[j] === "function") { // Prevent writing to function columns
          allowCopy = false;
          break;
        }
      }

      if (sourceType === "select" && allowCopy) {
        const sourceSelectValue = typeof sourceValue === "object" ? sourceValue.value : sourceValue;
        for (let j = minCol; j <= maxCol; j++) {
          // For select types, especially those with fetchOptions,
          // we primarily rely on the sourceValue being a valid {value, label} object.
          // The main check is that the target column is also a 'select' type.
          // Complex validation against all possible options during drag can be slow and might not be necessary
          // if the source cell already holds a valid selection for that column configuration.
          if (columnTypes[j] !== "select") { // This check is somewhat redundant due to the loop above, but good for clarity
            allowCopy = false;
            break;
          }
        }
      }

      if (allowCopy) {
        for (let i = minRow; i <= maxRow; i++) {
          for (let j = minCol; j <= maxCol; j++) {
            if (i < worksheets[0].grid.length && j < worksheets[0].grid[0].length) {
              if (sourceType === "select") {
                // Directly copy the sourceValue object if it's a select type
                // Assumes sourceValue is already in the correct {value, label} format.
                worksheets[0].grid[i][j].value = sourceValue;
              } else if (sourceType === "date") {
                worksheets[0].grid[i][j].value = normalizeDateValue(sourceValue);
              } else {
                worksheets[0].grid[i][j].value = sourceValue;
              }
            }
          }
        }
        // After copying, recalculate function cells for all affected rows
        for (let i = minRow; i <= maxRow; i++) {
          evaluateAllFunctionCellsInRow(i, worksheets[0].grid, columns);
        }
        worksheets = [...worksheets];
      }
    }

    dragStart = null;
    dragEnd = null;
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  function handleFillHandleKeydown(event, row, col) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startDrag(event, row, col);
    }
  }

  let isResizing = $state(false);
  let resizeColumnIndex = $state(null);
  let startX = $state(null);
  let startWidth = $state(null);

  function startResize(event, colIndex) {
    // Resizing should still be allowed for readonly columns
    event.preventDefault();
    isResizing = true;
    resizeColumnIndex = colIndex;
    startX = event.clientX;
    const th = event.target.closest("th");
    startWidth = parseInt(columnWidths[colIndex]) || th.getBoundingClientRect().width;
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  }

  function handleResize(event) {
    if (!isResizing) return;
    const delta = event.clientX - startX;
    const newWidth = Math.max(50, startWidth + delta);
    columnWidths[resizeColumnIndex] = `${newWidth}px`;
    columnWidths = [...columnWidths];
  }

  function stopResize() {
    if (!isResizing) return;
    isResizing = false;
    resizeColumnIndex = null;
    startX = null;
    startWidth = null;
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
  }

  function handleResizeKeydown(event, colIndex) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const currentWidth = parseInt(columnWidths[colIndex]) || 100;
      const step = 10;
      const newWidth = event.key === "ArrowLeft" ? Math.max(50, currentWidth - step) : currentWidth + step;
      columnWidths[colIndex] = `${newWidth}px`;
      columnWidths = [...columnWidths];
    }
  }

  // --- Public API ---
  export function getAllData() {
    if (!worksheets || worksheets.length === 0 || !worksheets[0].grid || !columns) {
      console.warn("Spreadsheet: Tidak dapat mengambil getAllData - komponen belum sepenuhnya terinisialisasi atau tidak ada data.");
      return [];
    }

    const currentGrid = worksheets[0].grid; // Assuming single sheet usage
    const allColumnsConfig = columns; // Use the component's columns prop
    const allData = [];

    for (const gridRow of currentGrid) {
      const rowObject = {};
      // Iterate over allColumnsConfig to ensure we use the defined keys and types
      allColumnsConfig.forEach((colDef, colIndex) => {
        // Ensure the column has a key and the gridRow has a cell for this index
        if (colDef.key && gridRow[colIndex]) {
          const gridCellContent = gridRow[colIndex].value; // Raw value from the grid cell

          if (colDef.type === 'select') {
            // Select column: output the object {value, label} as stored in the grid.
            rowObject[colDef.key] = gridCellContent;
          } else if (colDef.type === 'number') {
            // Number column: parse to number, or null if invalid/empty.
            // Grid stores numbers as strings (e.g., "123", "123.45", or even "").
            if (String(gridCellContent).trim() === "") {
                rowObject[colDef.key] = null; 
            } else {
                const num = parseFloat(String(gridCellContent));
                rowObject[colDef.key] = isNaN(num) ? null : num;
            }
          } else if (colDef.type === 'date') {
            // Date column: output the YYYY-MM-DD string as stored.
            rowObject[colDef.key] = gridCellContent;
          } else if (colDef.type === 'function') {
            // Function column: output the stringified result stored in the grid.
            rowObject[colDef.key] = gridCellContent;
          } else { // Default for 'text' or any other types
            rowObject[colDef.key] = gridCellContent;
          }
        } else if (colDef.key) {
          // If colDef.key exists but gridRow[colIndex] doesn't or has no value.
          rowObject[colDef.key] = null; 
        }
      });
      allData.push(rowObject);
    }
    return allData;
  }
</script>

<style>
  .marching-ants-highlight {
    outline-style: dashed;
    outline-color: #0ea5e9; /* Tailwind sky-500, for consistency with focus outline */
    outline-width: 2px;
    outline-offset: -2px; /* Draws inside the cell border, similar to focus */
  }
</style>

<svelte:window on:click={handleOutsideClick} />

<div class="max-w-full overflow-x-auto p-4 relative">
  <table
    id="spreadsheet-table"
    class="border-collapse w-full"
    role="grid"
    tabindex="0"
    onkeydown={handleKeydown}
  >
    <thead>
      <tr class="bg-white transition-colors duration-300 ease-in-out">
        <th class="border border-gray-300 p-0 text-center relative overflow-hidden bg-gray-100 font-bold w-8 min-w-[2rem]"></th>
        {#each columns?.length ? columns : Array.from({ length: worksheets[0]?.grid[0]?.length || 10 }) as col, j}
          <th style="width: {columnWidths[j]}; min-width: {columnWidths[j]}" class="border border-gray-300 p-0 relative overflow-hidden bg-gray-100 font-bold text-center">
            {columns?.length ? col.label : String.fromCharCode(65 + j)}
            <div
              class="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-blue-500 hover:opacity-50"
              onmousedown={(e) => startResize(e, j)}
              onkeydown={(e) => handleResizeKeydown(e, j)}
              role="button"
              tabindex="0"
              aria-label="Resize column {columns?.length ? col.label : String.fromCharCode(65 + j)}"
            ></div>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if worksheets && worksheets.length > 0 && worksheets[0].grid} {#each worksheets[0].grid as row, i}
        <tr class="{ i === focusedCell.row ? 'bg-blue-100' : 'bg-white' } transition-colors duration-300 ease-in-out" style="height: {rowHeight}px;">
          <th class="border border-gray-300 p-0 relative overflow-hidden font-normal text-center { i === focusedCell.row ? 'bg-transparent' : 'bg-white' } w-8 min-w-[2rem]" style="height: {rowHeight}px;">{i + 1}</th>
          {#each row as cell, j}
            {@const isFocused = i === focusedCell.row && j === focusedCell.col}
            {@const isDropdownVisibleForCell = dropdownState.visible && dropdownState.row === i && dropdownState.col === j}
            {@const isDatepickerVisibleForCell = datepickerState.visible && datepickerState.row === i && datepickerState.col === j}
            {@const hasErrorForCell = !!cellErrors[`${i}-${j}`]}
            {@const isOverflowVisible = isDropdownVisibleForCell || isDatepickerVisibleForCell || isFocused || hasErrorForCell}
            {@const isReadonlyCell = columnReadonly[j] || columnTypes[j] === "function"}
            <td
              class="border border-gray-300 p-0 text-left relative {isOverflowVisible ? '!overflow-visible' : 'overflow-hidden'}"
              class:outline={isFocused}
              class:outline-2={isFocused}
              class:outline-sky-500={isFocused}
              class:outline-offset-[-1px]={isFocused && columnTypes[j] === 'select' && columnReadonly[j]}
              class:outline-offset-[-2px]={isFocused && !(columnTypes[j] === 'select' && columnReadonly[j])}
              class:cursor-not-allowed={isReadonlyCell}
              class:bg-gray-100={isReadonlyCell}
              class:dark:bg-gray-700={isReadonlyCell}
              class:bg-transparent={!isReadonlyCell && i === focusedCell.row}
              class:bg-white={!isReadonlyCell && i !== focusedCell.row}
              class:fill-drag-highlight={
                isDragging &&
                dragStart && dragEnd &&
                i >= Math.min(dragStart.row, dragEnd.row) && i <= Math.max(dragStart.row, dragEnd.row) &&
                j >= Math.min(dragStart.col, dragEnd.col) && j <= Math.max(dragStart.col, dragEnd.col) &&
                !(i === dragStart.row && j === dragStart.col) 
              }
              class:marching-ants-highlight={
                isDragging &&
                dragStart && dragEnd &&
                i >= Math.min(dragStart.row, dragEnd.row) && i <= Math.max(dragStart.row, dragEnd.row) &&
                j >= Math.min(dragStart.col, dragEnd.col) && j <= Math.max(dragStart.col, dragEnd.col) &&
                !(i === dragStart.row && j === dragStart.col)
              }
              data-row={i}
              data-col={j}
              style="width: {columnWidths[j]}; min-width: {columnWidths[j]}; height: {rowHeight}px;"
              role="gridcell"
            >
              {#if columnTypes[j] === "select"}
                <div class="relative w-full h-full flex items-center">
                  <input
                    id="cell-{i}-{j}"
                    role="combobox"
                    type="text"
                    value={typeof cell.value === "object" && cell.value.label ? cell.value.label : ""}
                    oninput={(e) => handleInput(i, j, e)}
                    onfocus={(e) => {
                      focusedCell = { row: i, col: j };
                      e.target.select();
                      if (!columnReadonly[j]) { // Only open dropdown if not readonly
                        // dropdownState = { ...dropdownState, query: e.target.value, row: i, col: j, visible: true, filteredOptions: [], highlightedIndex: -1 };
                        // filterOptions(i, j, e.target.value);
                      }
                    }}
                    onkeydown={(e) => handleDropdownKeydown(e, i, j)}
                    placeholder="Type to search..."
                    readonly={columnReadonly[j]} 
                    class="w-full h-full border-none p-2 box-border outline-none text-[0.9rem] pr-6 {columnReadonly[j] ? 'cursor-not-allowed bg-transparent dark:bg-transparent' : ''}"
                    aria-invalid={cellErrors[`${i}-${j}`] ? "true" : "false"}
                    aria-describedby={cellErrors[`${i}-${j}`] ? `error-${i}-${j}` : undefined}
                    aria-haspopup="listbox"
                    aria-expanded={isDropdownVisibleForCell}
                    aria-controls={isDropdownVisibleForCell ? `dropdown-list-${i}-${j}` : undefined}
                    aria-activedescendant={isDropdownVisibleForCell && dropdownState.highlightedIndex >= 0 ? `option-${i}-${j}-${dropdownState.highlightedIndex}` : undefined}
                  />                  
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none z-[1] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" class="block text-gray-600">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </span>
                  {#if cellErrors[`${i}-${j}`]}
                    <span class="absolute bottom-[-20px] left-0 text-red-500 text-xs whitespace-nowrap z-10" id="error-{i}-${j}">
                      {cellErrors[`${i}-${j}`]}
                    </span>
                  {/if}
                  {#if isDropdownVisibleForCell}
                    <div class="dropdown fixed bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 border-t-0 max-h-[150px] overflow-y-auto z-20 shadow-md">
                      <ul
                        id="dropdown-list-{i}-{j}"
                        role="listbox"
                        class="list-none p-0 m-0"
                      >
                        {#if dropdownState.filteredOptions.length === 0 && dropdownState.query}
                          <li class="p-2 cursor-pointer block w-full text-left bg-transparent text-gray-500 dark:text-gray-400" role="option" aria-disabled="true" aria-selected="false">
                            Not found
                          </li>
                        {:else} {#each dropdownState.filteredOptions as option, index}
                          {@const isHighlighted = index === dropdownState.highlightedIndex}

                          <li
                            id="option-{i}-${j}-{index}"
                            role="option"
                            aria-selected={isHighlighted}
                            class="p-2 cursor-pointer block w-full text-left text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-sky-600 focus:bg-blue-100 dark:focus:bg-sky-600 focus:outline-none {
                              isHighlighted ? (document.documentElement.classList.contains('dark') ? 'dark:bg-sky-600' : 'bg-blue-100') : ''
                            }"                            
                            onclick={() => selectOption(i, j, option)}
                            onkeydown={(e) => {
                              if (e.key === "Enter") selectOption(i, j, option);
                            }}
                            tabindex="-1"
                          >
                            {option.label}
                          </li>
                        {/each}{/if}
                      </ul>
                    </div>
                  {/if}
                </div>
              {:else if columnTypes[j] === "date"}
                <div class="relative w-full h-full flex items-center">
                  <input
                    id="cell-{i}-{j}"
                    type="text"
                    value={formatDate(cell.value)}
                    oninput={(e) => handleInput(i, j, e)}
                    onfocus={(e) => {
                      focusedCell = { row: i, col: j };
                      toggleDatepicker(i, j, e);
                    }}
                    onkeydown={(e) => handleDateKeydown(e, i, j)}
                    onblur={(e) => handleDateBlur(i, j, e)}
                    placeholder="dd/mm/yyyy"
                    readonly={columnReadonly[j]} 
                    class="w-full h-full border-none p-2 box-border outline-none text-[0.9rem] pr-8 {columnReadonly[j] ? 'cursor-not-allowed bg-transparent dark:bg-transparent' : ''}"
                    aria-invalid={cellErrors[`${i}-${j}`] ? "true" : "false"}
                    aria-describedby={`calendar-icon-${i}-${j}${cellErrors[`${i}-${j}`] ? ` error-${i}-${j}` : ''}`}
                  />
                  <span
                    id="calendar-icon-{i}-{j}"
                    class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer flex items-center justify-center text-gray-600 hover:text-blue-500 z-[1]"
                    role="button"
                    tabindex="-1"
                    aria-label="Toggle date picker"
                    onclick={() => { // Keep onclick for mouse users
                      if (columnReadonly[j]) return;
                      focusedCell = { row: i, col: j };
                      const inputElement = document.querySelector(`#cell-${i}-${j}`);
                      if (inputElement) {
                        inputElement.focus(); 
                        toggleDatepicker(i, j, { target: inputElement });
                      }
                    }}
                    onkeydown={(event) => { // Add onkeydown for keyboard users
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault(); // Prevent default action for space/enter
                        // Execute the same logic as onclick
                        if (columnReadonly[j]) return;
                        focusedCell = { row: i, col: j };
                        const inputElement = document.querySelector(`#cell-${i}-${j}`);
                        if (inputElement) {
                          inputElement.focus();
                          toggleDatepicker(i, j, { target: inputElement });
                        }
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/>
                      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
                    </svg>
                  </span>
                  {#if cellErrors[`${i}-${j}`]}
                    <span class="absolute bottom-[-20px] left-0 text-red-500 text-xs whitespace-nowrap z-10" id="error-{i}-${j}">
                      {cellErrors[`${i}-${j}`]}
                    </span>
                  {/if}
                  {#if isDatepickerVisibleForCell}
                    <Datepicker
                      value={tempDateState.row === i && tempDateState.col === j ? tempDateState.value : cell.value}
                      onSelect={(date) => handleDateSelect(i, j, date)}
                      visible={datepickerState.visible}
                      position={datepickerState.position}
                    />
                  {/if}
                </div>
              {:else}
                <input
                  id="cell-{i}-{j}"
                  type="text"
                  value={
                    columnTypes[j] === 'number'
                      ? (isFocused ? cell.value : formatNumberWithSeparators(cell.value))
                      : (typeof cell.value === "object" ? cell.value.value : cell.value)
                  }
                  oninput={(e) => handleInput(i, j, e)}
                  onfocus={(e) => {
                    focusedCell = { row: i, col: j };
                    if (columnTypes[j] === 'number') {
                      e.target.value = cell.value; // Set ke nilai mentah saat fokus
                    }
                    e.target.select();
                  }}
                  onblur={(e) => columnTypes[j] === 'number' ? handleBlurForNumber(i,j,e) : null}
                  readonly={columnReadonly[j] || columnTypes[j] === "function"}
                  placeholder={columnTypes[j] === 'number' ? '0' : 'Enter value'}
                  class="w-full h-full border-none p-2 box-border outline-none text-[0.9rem] {(columnReadonly[j] || columnTypes[j] === 'function') ? 'cursor-not-allowed bg-transparent dark:bg-transparent' : ''}"
                  aria-invalid={cellErrors[`${i}-${j}`] ? "true" : "false"}
                  aria-describedby={cellErrors[`${i}-${j}`] ? `error-${i}-${j}` : undefined}
                />
                {#if cellErrors[`${i}-${j}`]}
                  <span class="absolute bottom-[-20px] left-0 text-red-500 text-xs whitespace-nowrap z-10" id="error-{i}-${j}">
                    {cellErrors[`${i}-${j}`]}
                  </span>
                {/if}
              {/if}
              {#if isFocused && !columnReadonly[j] && columnTypes[j] !== "function"}
                <div
                  class="absolute bottom-[-4.5px] right-[-4.5px] w-[7px] h-[7px] bg-sky-500 border border-white cursor-crosshair z-[15] p-0 leading-normal overflow-visible appearance-none focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-[-1px]"
                  role="button"
                  tabindex="0"
                  onmousedown={(e) => startDrag(e, i, j)}
                  onkeydown={(e) => handleFillHandleKeydown(e, i, j)}
                  aria-label="Drag to fill cells"></div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}{/if}
    </tbody>
  </table>
</div>
