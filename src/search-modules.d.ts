declare module 'virtual:site-search-url' {
  const url: string
  export default url
}
declare module 'virtual:site-search-entries' {
  const entries: import('./data/searchIndex').SearchEntry[]
  export default entries
}
