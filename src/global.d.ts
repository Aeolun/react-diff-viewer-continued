declare module '*.yaml?raw' {
  const data: string;
  export default data;
}

declare module '*.rjs?raw' {
  const data: string;
  export default data;
}
