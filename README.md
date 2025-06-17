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
  // Pastikan path import sesuai dengan struktur proyek Anda
  import Spreadsheet from '@sciefylab/svelte-spreadsheet';
</script>
```

### 2. Define Columns and Data

Define your column structure and initial data. The `columns` array is where you configure the behavior of each column, and `initialData` provides the starting rows.

```svelte
<script>
 import Spreadsheet from '@sciefylab/svelte-spreadsheet';

 let spreadsheetComponent; // Variabel untuk menyimpan instance komponen

 const columns = [
  {
    key: "name",
    label: "Name",
    type: "select",
    width: "150px",
    // Ambil opsi dari API eksternal
    fetchOptions: async (query) => {
      try {
        const response = await fetch('[https://jsonplaceholder.typicode.com/users](https://jsonplaceholder.typicode.com/users)');
        const users = await response.json();
        const options = users.map(user => ({ value: String(user.id), label: user.name }));
        // Filter hasil berdasarkan input pengguna
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
    format: "dd/mm/yyyy", // Format tanggal kustom
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
    // Tangani perubahan untuk memperbarui sel lain
    onChange: (selectedOption) => {
      if (selectedOption.value === "us") {
        return [{ targetColumnKey: "city", value: { value: "ny", label: "New York" } }];
      } else {
        return [{ targetColumnKey: "city", value: "" }]; // Kosongkan kota jika negara berubah
      }
    }
  },
  {
    key: "city",
    label: "City",
    type: "select",
    width: "120px",
    readonly: true, // Kolom ini sekarang dikontrol oleh kolom 'country'
    fetchParamsFromColumns: ["country"], // Bergantung pada kolom 'country'
    async fetchOptions(query, params) {
      const countryValue = params.country;
      let cities = [];
      // Simulasi pengambilan data kota berdasarkan negara yang dipilih
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
    // Hitung nilai berdasarkan sel lain di baris yang sama
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

 // Fungsi untuk mendapatkan semua data dari instance spreadsheet
 function handleGetAllData() {
  if (spreadsheetComponent) {
    const allData = spreadsheetComponent.getAllData();
    console.log("Semua data dari worksheet:", allData);
    alert("Data telah di-log ke konsol. Tekan F12 untuk melihat.");
  }
 }
</script>
```

### 3. Render the Component

Gunakan direktif `bind:this` untuk mendapatkan referensi ke instance komponen. Ini memungkinkan Anda untuk memanggil metode publiknya, seperti `getAllData()`.

```html
<!-- Tombol untuk memicu pengambilan data -->
<button on:click="{handleGetAllData}" class="my-4 p-2 bg-blue-500 text-white rounded">
  Get All Spreadsheet Data
</button>

<!-- Render spreadsheet -->
<Spreadsheet
  bind:this="{spreadsheetComponent}"
  {columns}
  {initialData}
/>
```

---

## ⚙️ API Reference

### Component Props

| Prop                | Type                  | Description                                                                                             |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `columns`           | `Array<Object>`       | **Wajib.** Array objek yang mendefinisikan struktur dan perilaku setiap kolom.                          |
| `initialData`       | `Array<Object>`       | Array objek yang merepresentasikan baris data awal untuk worksheet default.                             |
| `initialWorksheets` | `Array<Object>`       | Array untuk dukungan multi-sheet. Setiap objek harus berisi `{ name: string, data: Array<Object> }`.    |
| `rowHeight`         | `number`              | Tinggi setiap baris dalam piksel. Default `30`.                                                         |
| `showAddRow`        | `boolean`             | Jika `true`, menampilkan tombol untuk menambah baris baru. Default `true`.                              |

### Column Configuration

Setiap objek dalam prop `columns` dapat memiliki properti berikut:

| Key                      | Type                                     | Description                                                                                                   |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `key`                    | `string`                                 | **Wajib.** Pengidentifikasi unik untuk kolom, sesuai dengan kunci di objek data.                              |
| `label`                  | `string`                                 | **Wajib.** Nama tampilan untuk header kolom.                                                                  |
| `type`                   | `string`                                 | Tipe sel. Bisa berupa `'text'`, `'number'`, `'date'`, `'select'`, `'function'`. Default `'text'`.              |
| `width`                  | `string`                                 | Lebar CSS kolom (misalnya, `'150px'`).                                                                        |
| `readonly`               | `boolean`                                | Jika `true`, sel di kolom ini tidak dapat diedit.                                                             |
| `options`                | `Array`                                  | Array objek `{ value, label }` untuk kolom tipe `select`.                                                     |
| `fetchOptions`           | `async (query, params) => Array`         | Fungsi async untuk tipe `select` guna mengambil opsi secara dinamis. `query` adalah istilah pencarian.          |
| `fetchParamsFromColumns` | `Array<string>`                          | Array kunci kolom yang nilainya akan diteruskan sebagai objek `params` ke `fetchOptions`.                     |
| `onChange`               | `(selected, cell, row, cols) => Array`   | Callback untuk tipe `select` yang dipicu saat nilai berubah. Dapat mengembalikan array pembaruan untuk sel lain.|
| `function`               | `(rowData) => any`                       | Fungsi untuk tipe `function` yang menghitung nilai sel berdasarkan `rowData` saat ini.                        |
| `format`                 | `string`                                 | String format (misalnya, `'dd/mm/yyyy'`) untuk kolom tipe `date`.                                             |

### Component Methods

Anda dapat memanggil metode ini pada instance komponen yang diperoleh melalui `bind:this`.

| Method         | Parameters | Returns         | Description                                                          |
| -------------- | ---------- | --------------- | -------------------------------------------------------------------- |
| `getAllData()` | `none`     | `Array<Object>` | Mengembalikan data lengkap dan terkini dari semua baris di worksheet aktif. |

---

## 🤝 Contributing

Kontribusi, isu, dan permintaan fitur sangat diterima! Jangan ragu untuk memeriksa [halaman isu](https://github.com/sciefylab/svelte-spreadsheet/issues).

## 📜 License

Proyek ini berlisensi [MIT](https://opensource.org/licenses/MIT).
