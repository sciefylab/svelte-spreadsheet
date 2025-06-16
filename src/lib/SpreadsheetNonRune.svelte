<script>
  import Datepicker from './DatePickerNonRune.svelte'; // Menggunakan versi NonRune dari Datepicker
  import { tick, onMount, onDestroy } from 'svelte';

  export let initialData;
  export let columns;
  export let initialWorksheets = null;

  let columnWidths;
  $: columnWidths =
    columns?.length
      ? columns.map((col) => col.width || "100px")
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => "100px"
        );

  let columnTypes;
  $: columnTypes =
    columns?.length
      ? columns.map((col) => col.type || "text")
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => "text"
        );

  let columnOptions;
  $: columnOptions =
    columns?.length
      ? columns.map((col) => {
          if (col.type === "select" && col.options) {
            return col.options;
          }
          return [];
        })
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => []
        );

  let columnReadonly;
  $: columnReadonly =
    columns?.length
      ? columns.map((col) => !!col.readonly)
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => false
        );

  let columnFetchOptions;
  $: columnFetchOptions =
    columns?.length
      ? columns.map((col) =>
          col.type === "select" && col.fetchOptions
            ? { fn: col.fetchOptions, paramsFrom: col.fetchParamsFromColumns || [] }
            : null
        )
      : Array.from(
          { length: initialData?.[0] ? Object.keys(initialData[0]).length : 10 },
          () => null
        );

  let dropdownState = {
    col: -1,
    row: -1,
    visible: false,
    filteredOptions: [],
    query: "",
    highlightedIndex: -1,
  };

  let optionCache = {};
  let justSelected = false;

  let datepickerState = {
    row: -1,
    col: -1,
    visible: false,
    position: { top: 0, left: 0 },
  };

  let tempDateState = { row: -1, col: -1, value: "" };
  let cellErrors = {};
  let activeBlock = { row: -1, col: -1, block: "dd" };

  function normalizeSelectValue(col, rawValue) {
    if (typeof rawValue === "object" && rawValue?.value && rawValue?.label) {
      return rawValue;
    }
    const value = String(rawValue || "");
    const options = columnOptions[col]; // columnOptions sudah reaktif
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
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = input.match(regex);
    
    if (!match) return null;

    let [, day, month, year] = match;
    day = parseInt(day);
    month = parseInt(month) - 1;
    year = parseInt(year);
    if (year < 100) {
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

    const rawParts = input.split("/");
    const cleanedParts = rawParts.map(p => p.replace(/_/g, ""));

    const currentDate = new Date();
    let dInt = parseInt(cleanedParts[0]);
    let mInt = parseInt(cleanedParts[1]);
    let yInt = parseInt(cleanedParts[2]);

    const currentDay = currentDate.getDate();
    const currentMonth = currentDate.getMonth() + 1;
    const currentFullYear = currentDate.getFullYear();

    if (isNaN(dInt)) dInt = currentDay;
    if (isNaN(mInt)) mInt = currentMonth;
    
    if (isNaN(yInt)) {
        yInt = currentFullYear;
    } else {
        if (yInt >= 0 && yInt <= 99) {
            yInt = yInt < 50 ? 2000 + yInt : 1900 + yInt;
        } else if (yInt < 1000) {
            yInt = currentFullYear;
        }
    }

    dInt = Math.min(31, Math.max(1, dInt));
    mInt = Math.min(12, Math.max(1, mInt));

    const testDate = new Date(yInt, mInt - 1, dInt);

    if (isNaN(testDate.getTime()) || testDate.getFullYear() !== yInt || testDate.getMonth() !== (mInt - 1) || testDate.getDate() !== dInt) {
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
    
    let canonicalValueStr;
    const num = parseFloat(String(numStr));

    if (isNaN(num)) {
        return String(numStr); 
    }
    canonicalValueStr = String(num);

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

  function createGridFromData(data, currentColumns) { // Renamed 'columns' to 'currentColumns' to avoid conflict with prop
    if (!data?.length || !currentColumns?.length) {
      return Array.from({ length: 10 }, () =>
        Array.from({ length: currentColumns?.length || 10 }, () => ({ value: "" }))
      );
    }
    const grid = [];
    for (const row of data) {
      const gridRow = [];
      for (const [colIndex, col] of currentColumns.entries()) {
        const value = row[col.key];
        if (col.type === "select") {
          gridRow.push({ value: normalizeSelectValue(colIndex, value) });
        } else if (col.type === "date") {
          gridRow.push({ value: normalizeDateValue(value) });
        } else if (col.type === "number") {
          let finalValue = "";
          if (value !== null && value !== undefined) {
            const sValue = String(value).replace(/,/g, '').trim();
            if (sValue !== "") {
              const num = parseFloat(sValue);
              if (!isNaN(num)) {
                finalValue = String(num);
              } else {
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

  let worksheets = [];
  let focusedCell = { row: -1, col: -1 };

  $: { // Effect for initial data loading or when initialData/columns props change.
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
    worksheets = [{ name: "Sheet1", grid: gridToUse }];
  }

  function buildRowDataObject(gridRow, allColumnsConfig) {
    const rowData = {};
    if (!allColumnsConfig || !gridRow) return rowData;

    allColumnsConfig.forEach((colDef, index) => {
      if (colDef.key && gridRow[index]) {
        let cellVal = gridRow[index].value;

        if (colDef.type === 'select' && typeof cellVal === 'object' && cellVal !== null && cellVal.hasOwnProperty('value')) {
          cellVal = cellVal.value;
        }

        if (colDef.type === 'number') {
          const num = parseFloat(cellVal);
          rowData[colDef.key] = isNaN(num) ? null : num;
        } else if (colDef.type === 'date') {
          rowData[colDef.key] = cellVal;
        } else {
          rowData[colDef.key] = cellVal;
        }
      }
    });
    return rowData;
  }

  function evaluateAllFunctionCellsInRow(rowIndex, currentGrid, allColumnsConfig) {
    if (!currentGrid || !currentGrid[rowIndex] || !allColumnsConfig) return false;

    const rowCells = currentGrid[rowIndex];
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

  $: activeSheet = worksheets && worksheets.length > 0 ? worksheets[0] : { name: "Sheet1", grid: [] };

  function toggleDatepicker(row, col, event) {
    const input = event.target;
    const rect = input.getBoundingClientRect();
    if (columnReadonly[col]) return;

    const cellCurrentValue = worksheets[0].grid[row][col].value;
    const isCurrentlyVisibleForThisCell = datepickerState.visible && datepickerState.row === row && datepickerState.col === col;
    const shouldOpen = !isCurrentlyVisibleForThisCell;

    datepickerState = {
      row,
      col,
      visible: shouldOpen,
      position: { top: rect.bottom + window.scrollY, left: Math.max(5, rect.left + window.scrollX) },
    };

    if (shouldOpen) {
      focusedCell = { row, col };
      activeBlock = { row, col, block: "dd" };
      tempDateState = { row, col, value: cellCurrentValue };

      if (cellCurrentValue) {
        input.value = formatDate(cellCurrentValue);
      } else {
        input.value = "__/__/____";
      }
      input.dataset.tempValue = input.value;
      setTimeout(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(0, 2);
        }
      }, 0);
    } else {
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

    const input = document.querySelector(`#cell-${row}-${col}`);
    if (input) {
        input.dataset.tempValue = "";
    }
  }

  async function filterOptions(row, col, query) {
    if (columnReadonly[col]) return;

    const fetchConfig = columnFetchOptions[col];
    let options = [];

    if (fetchConfig && fetchConfig.fn) {
      const fetchFn = fetchConfig.fn;
      const paramsFrom = fetchConfig.paramsFrom;
      let additionalParams = {};
      let cacheKeyParts = [col, query];

      if (paramsFrom.length > 0) {
        for (const paramKey of paramsFrom) {
          const paramColIndex = columns.findIndex(c => c.key === paramKey);
          if (paramColIndex !== -1 && worksheets[0].grid[row] && worksheets[0].grid[row][paramColIndex]) {
            const cellValue = worksheets[0].grid[row][paramColIndex].value;
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
          options = await fetchFn(query, additionalParams);
          optionCache[cacheKey] = options;
          optionCache = { ...optionCache };
        } catch (error) {
          console.error(`Error fetching options for col ${col}, query "${query}":`, error);
          options = [];
        }
      }
    } else {
      if (Array.isArray(columnOptions[col])) {
        options = columnOptions[col].filter((opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase())
        );
      } else {
        console.error(`columnOptions[${col}] is not an array:`, columnOptions[col]);
        options = [];
      }
    }
    dropdownState = { 
      ...dropdownState, 
      filteredOptions: options, 
      row, 
      col, 
      highlightedIndex: -1,
    };
    updateDropdownPosition(row, col);
  }

  async function selectOption(row, col, option) {
    if (columnReadonly[col]) return;

    worksheets[0].grid[row][col].value = {
      value: option.value,
      label: option.label,
    };
    // worksheets = [...worksheets]; // Defer this until after onChange and evaluateAllFunctionCellsInRow

    const columnDef = columns[col];
    if (columnDef && typeof columnDef.onChange === 'function') {
      const currentGridRowCells = worksheets[0].grid[row];
      const fullRowDataObject = buildRowDataObject(currentGridRowCells, columns);

      const updatesToApply = columnDef.onChange(
        option,
        worksheets[0].grid[row][col],
        fullRowDataObject,
        columns
      );

      if (Array.isArray(updatesToApply)) {
        updatesToApply.forEach(update => {
          const targetColIndex = columns.findIndex(c => c.key === update.targetColumnKey);
          if (targetColIndex !== -1 && targetColIndex < currentGridRowCells.length) {
            if (columnReadonly[targetColIndex]) {
              console.warn(`Spreadsheet: onChange triggered for column '${columnDef.key}', but target column '${update.targetColumnKey}' is read-only. Skipping update.`);
              return;
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
            } else {
              worksheets[0].grid[row][targetColIndex].value = String(valueToSet == null ? "" : valueToSet);
            }
          }
        });
      }
    }

    evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
    worksheets = [...worksheets]; // Now update worksheets to reflect all changes
    dropdownState = { col: -1, row: -1, visible: false, filteredOptions: [], query: "", highlightedIndex: -1 };
    justSelected = true;

    await tick();

    const input = document.querySelector(`#cell-${row}-${col}`);
    if (input) {
      input.value = option.label; 
      input.focus();
    }

    setTimeout(() => {
      justSelected = false;
      if (input && document.activeElement !== input) {
        input.focus();
      }
    }, 16);
  }

  function handleInput(row, col, event) {
    const input = event.target;
    let value = input.value;
    if (columnReadonly[col]) return;

    if (columnTypes[col] === "number") {
      const rawValueFromInput = input.value;
      const cleanedValue = rawValueFromInput.replace(/,/g, '');
      const simpleNumericRegex = /^-?\d*\.?\d*$/;

      if (simpleNumericRegex.test(cleanedValue)) {
        if (worksheets[0].grid[row][col].value !== cleanedValue) {
          worksheets[0].grid[row][col].value = cleanedValue;
          worksheets = [...worksheets];
        }
        if (cellErrors[`${row}-${col}`]) {
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }
      } else {
        // cellErrors[`${row}-${col}`] = "Input harus berupa angka."; // Komentari atau hapus baris ini
        // setTimeout(() => {
        //   cellErrors[`${row}-${col}`] = "";
        //   cellErrors = { ...cellErrors };
        // }, 2000);
        // Kembalikan nilai input field ke nilai valid terakhir yang tersimpan di grid
        // untuk mencegah karakter tidak valid (seperti huruf) tetap ada.
        // Nilai grid itu sendiri tidak diubah oleh input yang tidak valid ini.
        input.value = worksheets[0].grid[row][col].value;
      }
    } else if (columnTypes[col] === "date") {
      input.dataset.tempValue = value;
      parsePartialDate(value, row, col);

      if (value && !/^[0-9/_]*$/.test(value)) {
        input.style.border = "1px solid red";
        cellErrors[`${row}-${col}`] = "Gunakan angka dan / saja (dd/mm/yyyy)";
        setTimeout(() => {
          if (input) input.style.border = "";
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
        return;
      }

      const tempValueForValidation = value;
      if (tempValueForValidation.replace(/_/g, "").length >= 8) {
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
        dropdownState = { 
          ...dropdownState, 
          query: value,
          highlightedIndex: -1
        };
        return; 
      }
      dropdownState = { ...dropdownState, query: value, row, col, visible: true, filteredOptions: [], highlightedIndex: -1 };
      filterOptions(row, col, value);
    } else {
      worksheets[0].grid[row][col].value = value;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
    }
  }

  function handleDateKeydown(event, row, col) {
    if (columnReadonly[col]) return;
    if (columnTypes[col] !== "date") return;
    const input = event.target;
    let tempValue = input.dataset.tempValue;

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
          if (!input) return;
          input.style.border = "";
          cellErrors[`${row}-${col}`] = "";
          cellErrors = { ...cellErrors };
        }, 2000);
        input.value = formatDate(currentValue);
        return;
      }
      const valueToCommit = parsedValue !== null ? parsedValue : currentValue || "";
      worksheets[0].grid[row][col].value = valueToCommit;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
      if (input) {
        input.value = formatDate(valueToCommit);
        input.dataset.tempValue = ""; 
      }
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };
      datepickerState = { ...datepickerState, visible: false };
    } else if (event.key === "Escape" && input) {
      event.preventDefault();
      input.value = formatDate(currentValue);
      input.dataset.tempValue = "";
      datepickerState = { ...datepickerState, visible: false };
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };
    } else if (event.key === "/") {
      event.preventDefault();
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
        if (input.selectionStart === 0 && input.selectionEnd === 2 && currentDayChars.length > 0) {
          dayCharsToBuild = event.key;
        } else {
          dayCharsToBuild = (currentDayChars + event.key);
        }
        let newDayChars = dayCharsToBuild.slice(0, 2);
        dayValue = newDayChars.padEnd(2, "_");
        newCursorPos = newDayChars.length;
        if (newDayChars.length === 2 && dayCharsToBuild.length <= 2) {
          newBlock = "mm";
          setTimeout(() => input.setSelectionRange(3, 5), 0);
        }
      } else if (activeBlock.block === "mm") {
        let currentMonthChars = monthValue.replace(/_/g, "");
        let monthCharsToBuild;
        if (input.selectionStart === 3 && input.selectionEnd === 5 && currentMonthChars.length > 0) {
          monthCharsToBuild = event.key;
        } else {
          monthCharsToBuild = (currentMonthChars + event.key);
        }
        let newMonthChars = monthCharsToBuild.slice(0, 2);
        monthValue = newMonthChars.padEnd(2, "_");
        newCursorPos = 3 + newMonthChars.length;
        if (newMonthChars.length === 2 && monthCharsToBuild.length <= 2) {
          newBlock = "yyyy";
          setTimeout(() => input.setSelectionRange(6, 10), 0);
        }
      } else if (activeBlock.block === "yyyy") {
        let currentYearChars = yearValue.replace(/_/g, "");
        let yearCharsToBuild;
        if (input.selectionStart === 6 && input.selectionEnd === 10 && currentYearChars.length > 0) {
          yearCharsToBuild = event.key;
        } else {
          yearCharsToBuild = (currentYearChars + event.key);
        }
        let newYearChars = yearCharsToBuild.slice(0, 4);
        yearValue = newYearChars.padEnd(4, "_");
        newCursorPos = 6 + newYearChars.length;
      }

      const newValue = `${dayValue}/${monthValue}/${yearValue}`;
      input.value = newValue;
      input.dataset.tempValue = newValue;

      const originalBlock = activeBlock.block;
      activeBlock = { row, col, block: newBlock };

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
        newBlock = "dd";
        let dayChars = day.replace(/_/g, "");
        if (dayChars.length > 0) { dayChars = dayChars.slice(0, -1); }
        day = dayChars.padEnd(2, "_");
        month = "__";
        year = "____";
        newCursorPos = dayChars.length;
      } else if (activeBlock.block === "yyyy" && input.selectionStart <= 6) {
        newBlock = "mm";
        let monthChars = month.replace(/_/g, "");
        if (monthChars.length > 0) { monthChars = monthChars.slice(0, -1); }
        month = monthChars.padEnd(2, "_");
        year = "____";
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
    if (columnReadonly[col]) return;
    if (columnTypes[col] !== "date") return;
    const input = event.target;
    const tempValue = input.dataset.tempValue || input.value;
    const parsedValue = parseDate(tempValue.replace(/_/g, ""));
    const currentValue = worksheets[0].grid[row][col].value;

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
      const valueToCommit = parsedValue !== null ? parsedValue : currentValue || "";
      worksheets[0].grid[row][col].value = valueToCommit;
      evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
      worksheets = [...worksheets];
      input.value = formatDate(valueToCommit);
    }
    input.dataset.tempValue = "";
    tempDateState = { row: -1, col: -1, value: "" };
    activeBlock = { row: -1, col: -1, block: "dd" };
  }

  function handleBlurForNumber(row, col, event) {
    if (columnReadonly[col]) return;
    const input = event.target;
    let value = input.value.replace(/,/g, '');
    let gridValueChanged = false;

    if (value === "" || value === "-") {
      const finalValue = ""; 
      if (worksheets[0].grid[row][col].value !== finalValue) {
        worksheets[0].grid[row][col].value = "";
        gridValueChanged = true;
      }
    } else {
      const parsedNumber = parseFloat(value);
      if (isNaN(parsedNumber)) {
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
        }
      }
    }
    const functionsChanged = evaluateAllFunctionCellsInRow(row, worksheets[0].grid, columns);
    if (gridValueChanged || functionsChanged) {
      worksheets = [...worksheets];
    }
  }
  function handleDropdownKeydown(event, row, col) {
    if (columnReadonly[col]) return;
    if (columnTypes[col] !== "select" || !dropdownState.visible) return;
    const { filteredOptions, highlightedIndex } = dropdownState;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const newIndex = Math.min(filteredOptions.length - 1, highlightedIndex + 1);
      dropdownState = { ...dropdownState, highlightedIndex: newIndex };
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
      if (newIndex >= 0 && newIndex < filteredOptions.length) {
        const optionElement = document.querySelector(`#option-${row}-${col}-${newIndex}`);
        if (optionElement) {
          optionElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
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
      const inputRect = input.getBoundingClientRect();
      
      dropdown.style.top = `${inputRect.bottom}px`;
      dropdown.style.left = `${inputRect.left}px`;
      
      const minDropdownWidth = 180;
      dropdown.style.width = `${Math.max(inputRect.width, minDropdownWidth)}px`;
    }
  }

  let updateDropdownListenersAttached = false;
  const updateDropdownPositionOnEvent = () => {
    if (dropdownState.visible && dropdownState.row !== -1 && dropdownState.col !== -1) {
      updateDropdownPosition(dropdownState.row, dropdownState.col);
    }
  };

  $: { // Effect for dropdown position
    if (dropdownState.visible && dropdownState.row !== -1 && dropdownState.col !== -1) {
      if (!updateDropdownListenersAttached) {
        window.addEventListener("resize", updateDropdownPositionOnEvent);
        window.addEventListener("scroll", updateDropdownPositionOnEvent);
        updateDropdownListenersAttached = true;
      }
      tick().then(() => {
        if (dropdownState.visible && dropdownState.row !== -1 && dropdownState.col !== -1) {
          updateDropdownPosition(dropdownState.row, dropdownState.col);
        }
      });
    } else if (!dropdownState.visible && updateDropdownListenersAttached) {
      window.removeEventListener("resize", updateDropdownPositionOnEvent);
      window.removeEventListener("scroll", updateDropdownPositionOnEvent);
      updateDropdownListenersAttached = false;
    }
  }

  onDestroy(() => {
    if (updateDropdownListenersAttached) {
      window.removeEventListener("resize", updateDropdownPositionOnEvent);
      window.removeEventListener("scroll", updateDropdownPositionOnEvent);
      updateDropdownListenersAttached = false;
    }
  });

  function handleOutsideClick(event) {
    if (datepickerState.visible) {
      const datepicker = document.querySelector(".spreadsheet-datepicker-popup");
      const input = document.querySelector(`#cell-${datepickerState.row}-${datepickerState.col}`);
      if (datepicker && input && !datepicker.contains(event.target) && !input.contains(event.target)) {
        datepickerState = { ...datepickerState, visible: false };
        tempDateState = { row: -1, col: -1, value: "" };
        activeBlock = { row: -1, col: -1, block: "dd" };
      }
    }
    if (dropdownState.visible) {
      const dropdownElement = document.querySelector('.dropdown');
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
    if (!worksheets || !worksheets[0] || !worksheets[0].grid || !worksheets[0].grid[0]) return; // Guard against uninitialized grid
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
      focusedCell = { row: newRow, col: newCol };
      dropdownState = { col: -1, row: -1, visible: false, filteredOptions: [], query: "", highlightedIndex: -1 };

      if (datepickerState.visible && (datepickerState.row !== newRow || datepickerState.col !== newCol)) {
          datepickerState = { ...datepickerState, visible: false };
      }
      
      datepickerState = { ...datepickerState, visible: false }; // Always close datepicker on cell navigation
      tempDateState = { row: -1, col: -1, value: "" };
      activeBlock = { row: -1, col: -1, block: "dd" };

      setTimeout(() => {
        const inputElement = document.querySelector(`#cell-${newRow}-${newCol}`);
        if (inputElement) {
          inputElement.focus();
          if (columnTypes[newCol] === "date") {
            // toggleDatepicker will be called by onfocus
          } else {
            inputElement.select();
          }
        }
      }, 0);
    }
  }

  let isDragging = false;
  let dragStart = null;
  let dragEnd = null;

  function startDrag(event, row, col) {
    if (columnReadonly[col]) return;
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

      let allowCopy = true;

      for (let j = minCol; j <= maxCol; j++) {
        if (columnTypes[j] !== sourceType) {
          allowCopy = false;
          break;
        }
        if (columnReadonly[j] || columnTypes[j] === "function") {
          allowCopy = false;
          break;
        }
      }

      if (sourceType === "select" && allowCopy) {
        // const sourceSelectValue = typeof sourceValue === "object" ? sourceValue.value : sourceValue; // Not needed if sourceValue is already {value, label}
        for (let j = minCol; j <= maxCol; j++) {
          if (columnTypes[j] !== "select") {
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
                worksheets[0].grid[i][j].value = sourceValue;
              } else if (sourceType === "date") {
                worksheets[0].grid[i][j].value = normalizeDateValue(sourceValue);
              } else {
                worksheets[0].grid[i][j].value = sourceValue;
              }
            }
          }
        }
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

  let isResizing = false;
  let resizeColumnIndex = null;
  let startX = null;
  let startWidth = null;

  function startResize(event, colIndex) {
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

  export function getAllData() {
    if (!worksheets || worksheets.length === 0 || !worksheets[0].grid || !columns) {
      console.warn("Spreadsheet: Tidak dapat mengambil getAllData - komponen belum sepenuhnya terinisialisasi atau tidak ada data.");
      return [];
    }

    const currentGrid = worksheets[0].grid;
    const allColumnsConfig = columns;
    const allData = [];

    for (const gridRow of currentGrid) {
      const rowObject = {};
      allColumnsConfig.forEach((colDef, colIndex) => {
        if (colDef.key && gridRow[colIndex]) {
          const gridCellContent = gridRow[colIndex].value;

          if (colDef.type === 'select') {
            rowObject[colDef.key] = gridCellContent;
          } else if (colDef.type === 'number') {
            if (String(gridCellContent).trim() === "") {
                rowObject[colDef.key] = null; 
            } else {
                const num = parseFloat(String(gridCellContent));
                rowObject[colDef.key] = isNaN(num) ? null : num;
            }
          } else if (colDef.type === 'date') {
            rowObject[colDef.key] = gridCellContent;
          } else if (colDef.type === 'function') {
            rowObject[colDef.key] = gridCellContent;
          } else {
            rowObject[colDef.key] = gridCellContent;
          }
        } else if (colDef.key) {
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
        {#each columns?.length ? columns : Array.from({ length: activeSheet?.grid[0]?.length || 10 }) as col, j}
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
      {#if activeSheet && activeSheet.grid} {#each activeSheet.grid as row, i}
        <tr class="{ i === focusedCell.row ? 'bg-blue-100' : 'bg-white' } transition-colors duration-300 ease-in-out">
          <th class="border border-gray-300 p-0 relative overflow-hidden font-normal text-center { i === focusedCell.row ? 'bg-transparent' : 'bg-white' } w-8 min-w-[2rem]">{i + 1}</th>
          {#each row as cell, j}
            {@const isFocused = i === focusedCell.row && j === focusedCell.col}
            {@const isDropdownVisibleForCell = dropdownState.visible && dropdownState.row === i && dropdownState.col === j}
            {@const isDatepickerVisibleForCell = datepickerState.visible && datepickerState.row === i && datepickerState.col === j}
            {@const hasErrorForCell = !!cellErrors[`${i}-${j}`]}
            {@const isOverflowVisible = isDropdownVisibleForCell || isDatepickerVisibleForCell || isFocused || hasErrorForCell}
            <td
              role="gridcell"
              class="border border-gray-300 p-0 text-left relative { i === focusedCell.row ? 'bg-transparent' : 'bg-white' } {isOverflowVisible ? '!overflow-visible' : 'overflow-hidden'}"
              class:outline={isFocused}
              class:outline-2={isFocused}
              class:outline-sky-500={isFocused}
              class:outline-offset-[-1px]={isFocused && columnTypes[j] === 'select' && columnReadonly[j]}
              class:outline-offset-[-2px]={isFocused && !(columnTypes[j] === 'select' && columnReadonly[j])}
              class:cursor-not-allowed={columnReadonly[j] || columnTypes[j] === "function"}
              class:bg-gray-50={(columnReadonly[j] || columnTypes[j] === "function") && !(i === focusedCell.row)}
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
              style="width: {columnWidths[j]}; min-width: {columnWidths[j]}"
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
                      if (!columnReadonly[j]) {
                        // dropdownState = { ...dropdownState, query: e.target.value, row: i, col: j, visible: true, filteredOptions: [], highlightedIndex: -1 };
                        // filterOptions(i, j, e.target.value);
                      }
                    }}
                    onkeydown={(e) => handleDropdownKeydown(e, i, j)}
                    placeholder="Type to search..."
                    readonly={columnReadonly[j]} 
                    class="w-full h-8 border-none p-2 box-border outline-none text-[0.9rem] pr-6 {columnReadonly[j] ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}"
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
                    <span class="absolute bottom-[-20px] left-0 text-red-500 text-xs whitespace-nowrap z-10" id="error-{i}-{j}">
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
                            id="option-{i}-{j}-{index}"
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
                    class="w-full h-8 border-none p-2 box-border outline-none text-[0.9rem] pr-8 {columnReadonly[j] ? 'cursor-not-allowed' : ''}"
                    aria-invalid={cellErrors[`${i}-${j}`] ? "true" : "false"}
                    aria-describedby={`calendar-icon-${i}-${j}${cellErrors[`${i}-${j}`] ? ` error-${i}-${j}` : ''}`}
                  />
                  <span
                    id="calendar-icon-{i}-{j}"
                    class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer flex items-center justify-center text-gray-600 hover:text-blue-500 z-[1]"
                    role="button"
                    tabindex="-1"
                    aria-label="Toggle date picker"
                    onclick={() => { 
                      if (columnReadonly[j]) return;
                      focusedCell = { row: i, col: j };
                      const inputElement = document.querySelector(`#cell-${i}-${j}`);
                      if (inputElement) {
                        inputElement.focus(); 
                        toggleDatepicker(i, j, { target: inputElement });
                      }
                    }}
                    onkeydown={(event) => { 
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault(); 
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
                      e.target.value = cell.value;
                    }
                    e.target.select();
                  }}
                  onblur={(e) => columnTypes[j] === 'number' ? handleBlurForNumber(i,j,e) : null}
                  readonly={columnReadonly[j] || columnTypes[j] === "function"}
                  placeholder={columnTypes[j] === 'number' ? '0' : 'Enter value'}
                  class="w-full h-8 border-none p-2 box-border outline-none text-[0.9rem] {(columnReadonly[j] || columnTypes[j] === 'function') ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}"
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