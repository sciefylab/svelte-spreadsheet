<script>
  let { 
    value = "", // YYYY-MM-DD
    onSelect = (date) => {}, // Callback for selected date (YYYY-MM-DD)
    visible = false, // Control visibility
    position = { top: 0, left: 0 } // Positioning
  } = $props();

  // Get today's date, normalized to the start of the day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Represents the date that is visually selected or focused in the calendar grid.
  // Initialized from the `value` prop. If `value` is invalid/empty, it's null.
  let selectedDate = $state(value && !isNaN(new Date(value + "T00:00:00").getTime()) ? new Date(value + "T00:00:00") : null);
  
  // Initialize currentMonth and currentYear based on the initial `value` prop or current date.
  let initialViewDate;
  if (value && !isNaN(new Date(value + "T00:00:00").getTime())) {
    initialViewDate = new Date(value + "T00:00:00");
  } else {
    initialViewDate = new Date(); // Default to actual current date
  }
  let currentMonth = $state(initialViewDate.getMonth());
  let currentYear = $state(initialViewDate.getFullYear());

  let focusedElement = $state(null); // Track focused element for keyboard navigation
  let errorMessage = $state(""); // Error message state


  $effect(() => {
    // Validate input value
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errorMessage = "Invalid date format. Use YYYY-MM-DD";
      setTimeout(() => (errorMessage = ""), 2000);
    } else if (value && isNaN(new Date(value + "T00:00:00").getTime())) {
      errorMessage = "Invalid date";
      setTimeout(() => (errorMessage = ""), 2000);
    } else {
      errorMessage = "";
    }

    // Synchronize internal state (selectedDate and calendar view month/year) with the `value` prop.
    // This runs on initial mount (after initial state is set) and whenever `value` changes.
    if (value && !isNaN(new Date(value + "T00:00:00").getTime())) {
      const dateFromValue = new Date(value + "T00:00:00");
      selectedDate = dateFromValue;
      currentMonth = dateFromValue.getMonth();
      currentYear = dateFromValue.getFullYear();
    } else {
      // If value is empty or invalid, clear selectedDate in UI
      selectedDate = null;
      // And reset calendar view to the actual current month/year
      const todayActual = new Date();
      currentMonth = todayActual.getMonth();
      currentYear = todayActual.getFullYear();
    }
  });

  // Generate days for the current month
  function getDaysInMonth(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDays = lastDay.getDate();

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }

  let days = $derived(getDaysInMonth(currentYear, currentMonth));

  // Format date to YYYY-MM-DD
  function formatISODate(date) {
    if (!date) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  // Parse input to YYYY-MM-DD
  function parseDate(input) {
    if (!input) return null;
    const regex = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$|^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/;
    const match = input.match(regex);
    if (!match) return null;

    let day, month, year;
    if (match[4]) {
      [, , , , year, month, day] = match;
    } else {
      [, day, month, year] = match;
    }
    day = parseInt(day);
    month = parseInt(month) - 1;
    year = parseInt(year);
    if (year < 100) {
      const currentYear = new Date().getFullYear();
      const century = year < 50 ? 2000 : 1900;
      year = century + year;
    }
    const date = new Date(year, month, day);
    if (isNaN(date.getTime()) || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }
    return formatISODate(date);
  }

  // Handle date selection
  function selectDate(date) {
    if (!date) return;
    selectedDate = date;
    const formatted = formatISODate(date);
    onSelect(formatted);
    visible = false;
  }

  // Navigate months
  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else {
      currentMonth -= 1;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear += 1;
    } else {
      currentMonth += 1;
    }
  }

  // Navigate years
  function prevYear() {
    currentYear -= 1;
  }

  function nextYear() {
    currentYear += 1;
  }

  // Select today
  function selectToday() {
    selectDate(today);
  }

  // Clear date
  function clearDate() {
    selectedDate = null;
    onSelect("");
    visible = false;
  }

  // Month names
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Check if a date is today
  function isToday(date) {
    if (!date) return false;
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!visible) return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        if (selectedDate) {
          const prevDay = new Date(selectedDate);
          prevDay.setDate(selectedDate.getDate() - 1);
          currentMonth = prevDay.getMonth();
          currentYear = prevDay.getFullYear();
          selectedDate = prevDay;
        }
        break;
      case "ArrowRight":
        event.preventDefault();
        if (selectedDate) {
          const nextDay = new Date(selectedDate);
          nextDay.setDate(selectedDate.getDate() + 1);
          currentMonth = nextDay.getMonth();
          currentYear = nextDay.getFullYear();
          selectedDate = nextDay;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (selectedDate) {
          const prevWeek = new Date(selectedDate);
          prevWeek.setDate(selectedDate.getDate() - 7);
          currentMonth = prevWeek.getMonth();
          currentYear = prevWeek.getFullYear();
          selectedDate = prevWeek;
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (selectedDate) {
          const nextWeek = new Date(selectedDate);
          nextWeek.setDate(selectedDate.getDate() + 7);
          currentMonth = nextWeek.getMonth();
          currentYear = nextWeek.getFullYear();
          selectedDate = nextWeek;
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (selectedDate) {
          selectDate(selectedDate);
        }
        break;
      case "Escape":
        event.preventDefault();
        visible = false;
        break;
      case "t":
      case "T":
        event.preventDefault();
        selectToday();
        break;
      case "c":
      case "C":
        event.preventDefault();
        clearDate();
        break;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <div
    class="spreadsheet-datepicker-popup-runes fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-[1000] p-2.5 w-[250px] font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
    style="top: {position.top}px; left: {position.left}px;"
    role="dialog"
    aria-label="Date picker"
    tabindex="0"
    onfocus={() => (focusedElement = 'datepicker')}
  >
    {#if errorMessage}
      <div class="text-red-500 dark:text-red-400 text-xs mb-2 text-center">{errorMessage}</div>
    {/if}
    <div class="flex justify-between items-center mb-2.5">
      <button
        onclick={prevYear}
        aria-label="Previous year"
        title="Previous year"
        class="bg-transparent text-gray-700 dark:text-gray-300 border-none cursor-pointer text-base p-1.25 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="inline-block">
          <path fill-rule="evenodd" d="M8.354 1.646a.5.5 0 0 1 0 .708L2.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
          <path fill-rule="evenodd" d="M12.354 1.646a.5.5 0 0 1 0 .708L6.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
        </svg>
      </button>
      <button
        onclick={prevMonth}
        aria-label="Previous month"
        title="Previous month"
        class="bg-transparent text-gray-700 dark:text-gray-300 border-none cursor-pointer text-base p-1.25 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="inline-block">
          <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
        </svg>
      </button>
      <span class="font-bold text-sm text-gray-800 dark:text-gray-200">{months[currentMonth]} {currentYear}</span>
      <button
        onclick={nextMonth}
        aria-label="Next month"
        title="Next month"
        class="bg-transparent text-gray-700 dark:text-gray-300 border-none cursor-pointer text-base p-1.25 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="inline-block">
          <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
      <button
        onclick={nextYear}
        aria-label="Next year"
        title="Next year"
        class="bg-transparent text-gray-700 dark:text-gray-300 border-none cursor-pointer text-base p-1.25 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="inline-block">
          <path fill-rule="evenodd" d="M3.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L9.293 8 3.646 2.354a.5.5 0 0 1 0-.708z"/>
          <path fill-rule="evenodd" d="M7.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L13.293 8 7.646 2.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="flex justify-between mb-2.5">
      <button
        onclick={selectToday}
        aria-label="Select today"
        title="Select today (T)"
        class="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-500 rounded-md py-1.25 px-2.5 cursor-pointer text-xs hover:bg-blue-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        Today
      </button>
      <button
        onclick={clearDate}
        aria-label="Clear date"
        title="Clear date (C)"
        class="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-500 rounded-md py-1.25 px-2.5 cursor-pointer text-xs hover:bg-blue-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        Clear
      </button>
    </div>
    <div class="grid gap-0.5">
      <div class="grid grid-cols-7 text-center text-xs mb-1.25 text-gray-600 dark:text-gray-400">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span>
        <span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="grid grid-cols-7 gap-0.5">
        {#each days as day, index}
          {#if day}
            <button
              class="border-none p-2 cursor-pointer rounded-md text-center text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 {
                (selectedDate && day.toDateString() === selectedDate.toDateString())
                  ? (isToday(day)
                      ? 'bg-sky-600 dark:bg-sky-500 text-white dark:text-white font-bold'
                      : 'bg-sky-600 dark:bg-sky-500 text-white dark:text-white')
                  : (isToday(day)
                      ? 'bg-yellow-300 dark:bg-yellow-500 text-yellow-800 dark:text-yellow-900 font-bold'
                      : 'bg-transparent dark:bg-transparent')
              }"
              onclick={() => selectDate(day)}
              onfocus={() => (focusedElement = `day-${index}`)}
              aria-label={`Select ${formatISODate(day)}`}
              title={formatISODate(day)}
            >
              {day.getDate()}
            </button>
          {:else}
            <span class="h-8"></span> <!-- h-8 is 2rem which is approx 32px -->
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}
<style>
  /* Tailwind CSS classes are now used directly in the HTML */
</style>