<script>
  import SpreadsheetNonRune from '$lib/SpreadsheetNonRune.svelte';

  let spreadsheetComponent;

  const initialDataTest2 = [
    {
      productName: "Laptop Pro X",
      category: { value: "electronics", label: "Electronics" },
      stock: 25,
      price: 1200.00,
      lastOrderDate: "2023-10-15",
      isActive: { value: "yes", label: "Yes" },
    },
    {
      productName: "Office Chair Ergo",
      category: { value: "furniture", label: "Furniture" },
      stock: 10,
      price: 250.50,
      lastOrderDate: "2023-11-01",
      isActive: { value: "yes", label: "Yes" },
    },
    {
      productName: "Wireless Mouse",
      category: { value: "electronics", label: "Electronics" },
      stock: 150,
      price: 25.99,
      lastOrderDate: null, // No last order
      isActive: { value: "no", label: "No" },
    },
    {
      productName: "Desk Lamp LED",
      category: { value: "home_goods", label: "Home Goods" },
      stock: 0, // Out of stock
      price: 45.00,
      lastOrderDate: "2023-09-01",
      isActive: { value: "yes", label: "Yes" },
    },
  ];

  const columnsTest2 = [
    {
      key: "productName",
      label: "Product Name",
      type: "text",
      width: "200px",
    },
    {
      key: "category",
      label: "Category",
      type: "select",
      width: "150px",
      options: [
        { value: "electronics", label: "Electronics" },
        { value: "furniture", label: "Furniture" },
        { value: "home_goods", label: "Home Goods" },
        { value: "stationery", label: "Stationery" },
      ],
      onChange: (selectedOption, currentCell, fullRowData, allColumns) => {
        console.log("Category changed:", selectedOption, "for product:", fullRowData.productName);
        if (selectedOption.value === "stationery") {
          // Example: If category is stationery, mark as inactive
          return [{ targetColumnKey: "isActive", value: { value: "no", label: "No" } }];
        }
      }
    },
    {
      key: "stock",
      label: "Stock",
      type: "number",
      width: "80px",
    },
    {
      key: "price",
      label: "Price (USD)",
      type: "number",
      width: "120px",
    },
    {
      key: "totalValue",
      label: "Total Value",
      type: "function",
      width: "130px",
      function: (rowData) => {
        // rowData.stock and rowData.price will be numbers or null
        if (rowData.stock != null && rowData.price != null) {
          return (rowData.stock * rowData.price).toFixed(2);
        }
        return "N/A";
      },
    },
    {
      key: "lastOrderDate",
      label: "Last Order",
      type: "date",
      width: "150px",
    },
    {
      key: "isActive",
      label: "Active",
      type: "select",
      width: "100px",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      readonly: true, // Example of a readonly select, perhaps controlled by other logic
    },
  ];

  function handleGetAllDataTest2() {
    if (spreadsheetComponent) {
      const allData = spreadsheetComponent.getAllData();
      console.log("Semua data dari Test Page 2:", allData);
      alert("Data dari Test Page 2 telah di-log ke konsol. Tekan F12 untuk melihat.");
    }
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Spreadsheet Test Page 2 - Inventory</h1>
  <p class="mb-4">
    Halaman ini menguji komponen Spreadsheet dengan set data dan konfigurasi kolom yang berbeda,
    fokus pada skenario inventaris produk.
  </p>

  <button
    onclick={handleGetAllDataTest2}
    class="my-4 p-2 bg-green-500 text-white rounded hover:bg-green-600"
  >
    Get All Data (Test Page 2)
  </button>

  <SpreadsheetNonRune bind:this={spreadsheetComponent} initialData={initialDataTest2} columns={columnsTest2} />
</div>