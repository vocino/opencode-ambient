// Hatch offline shims - real CI installs actual deps
// Keep exports wide to allow tests to import vitest helpers without TS errors
declare module 'vitest' {
  export const describe: any;
  export const it: any;
  export const test: any;
  export const expect: any;
  export const beforeEach: any;
  export const afterEach: any;
  export const beforeAll: any;
  export const afterAll: any;
  export const vi: any;
}
declare module '@inquirer/prompts' {
  export const input: any;
  export const select: any;
  export const confirm: any;
  export const checkbox: any;
}
