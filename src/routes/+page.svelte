<script>
 import Spreadsheet from '$lib/Spreadsheet.svelte'; // Menggunakan versi Runes

 let spreadsheetComponent; // Variabel untuk menyimpan instance komponen Spreadsheet

const initialData = [
  {
    name: { value: "1", label: "Leanne Graham" }, // Disesuaikan dengan format select dan data API
    age: 30,
    country: { value: "us", label: "United States" },
    city: { value: "ny", label: "New York" },
    birthdate: "1995-05-15",
  },
  {
    name: { value: "2", label: "Ervin Howell" }, // Disesuaikan dengan data API (id: 2)
    age: 25,
    country: { value: "ca", label: "Canada" },
    city: { value: "to", label: "Toronto" },
    birthdate: "2000-08-22",
  },
  {
    name: { value: "3", label: "Clementine Bauch" }, // Disesuaikan dengan data API (id: 3)
    age: 40,
    country: { value: "mx", label: "Mexico" },
    city: { value: "mc", label: "Mexico City" },
    birthdate: "1985-03-10",
  },
];


//console.log(JSON.stringify(initialData))

const columns = [
  { 
    key: "name", 
    label: "Name", 
    type: "select", // Ubah tipe menjadi select agar bisa menggunakan fetchOptions
    width: "150px",
    
    fetchOptions: async (query) => {
      try {
        const response = await fetch('https://jsonplaceholder.typicode.com/users');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        const options = users.map(user => ({
          value: String(user.id), 
          label: user.name
        }));
        return options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()));
      } catch (error) {
        console.error("Failed to fetch users for Name column:", error);
        return [];
      }
    },
  },
  { 
    key: "age", 
    label: "Age", 
    type: "number", 
    width: "100px", 
   // readonly: true 
  },
  {
    key: "birthdate",
    label: "Birthdate",
    type: "date",
    width: "150px",
    format: "dd/mm/yyyy",
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
    onChange: (selectedOption, currentCell, fullRowData, allColumns) => {
      // Ketika negara berubah, set kota default atau kosongkan
      if (selectedOption.value === "us") {
        return [
          // Set kota menjadi New York jika negara adalah US
          { targetColumnKey: "city", value: { value: "ny", label: "New York" } }
        ];
      } else {
        // Untuk negara lain, kosongkan kota
        return [{ targetColumnKey: "city", value: "" }];
      }
    }
  },
  {
    key: "city",
    label: "City",
    type: "select",
    width: "120px",
    readonly: true,
    fetchParamsFromColumns: ["country"], // Depends on the 'country' column
    async fetchOptions(query, params) {
      const countryValue = params.country; // e.g., "us", "ca", "mx"
      let cities = [];

      // Simulate fetching cities based on country
      if (countryValue === "us") {
        cities = [
          { value: "ny", label: "New York" },
          { value: "la", label: "Los Angeles" },
          { value: "chi", label: "Chicago" },
        ];
      } else if (countryValue === "ca") {
        cities = [
          { value: "to", label: "Toronto" },
          { value: "va", label: "Vancouver" },
          { value: "mtl", label: "Montreal" },
        ];
      } else if (countryValue === "mx") {
        cities = [
          { value: "mc", label: "Mexico City" },
          { value: "gua", label: "Guadalajara" },
          { value: "mty", label: "Monterrey" },
        ];
      } else {
        // No country selected or unknown country, return no cities or all cities
        return []; // Or fetch all possible cities if that's desired
      }

      return cities.filter(city => city.label.toLowerCase().includes(query.toLowerCase()));
    }
  },
  {
    key: "age_next_year",
    label: "Age Next Year",
    type: "function",
    // Perhatikan: 'rowData' adalah data untuk baris saat ini,
    // bukan seluruh array 'initialData'.
    // rowData.age sekarang akan menjadi number atau null.
    // Kondisi `rowData.age != null` menangani usia 0 dengan benar.
    function: (rowData) => (rowData.age != null) ? rowData.age + 1 : ""

  }
  
];

const initialWorksheets = null;

 function handleGetAllData() {
  if (spreadsheetComponent) {
    const allData = spreadsheetComponent.getAllData();
    console.log("Semua data dari worksheet:", allData);
    // Anda bisa melakukan apa saja dengan allData di sini,
    // misalnya mengirim ke server, menampilkannya, dll.
    alert("Data telah di-log ke konsol. Tekan F12 untuk melihat.");
  }
 }

</script>


<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
<button onclick={handleGetAllData} class="my-4 p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Get All Data from Spreadsheet
</button>

<Spreadsheet bind:this={spreadsheetComponent} {initialData} {columns} {initialWorksheets} />
