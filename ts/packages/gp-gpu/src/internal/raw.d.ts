// Vite's ?raw imports: a file of the repository as text (the C# code's embedded resources: symbols/*.txt).
declare module "*?raw" {
  const text: string;
  export default text;
}
