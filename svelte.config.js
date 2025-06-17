
/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: true // Eksplisit mengaktifkan Runes untuk Svelte 5
	},
	kit: {

		// files: {
		// 	lib: 'src/lib' // Lokasi default untuk kode library Anda
		// },
		// package: {
		// 	dir: 'dist' // Mengarahkan output dari svelte-package ke direktori 'dist'
		// }
	}
};

export default config;
