// Hatch offline shims - real CI installs actual deps
declare module 'vitest' { export const describe: any; export const it: any; export const expect: any; }
declare module '@inquirer/prompts' { export const input: any; export const select: any; export const confirm: any; export const checkbox: any; }
