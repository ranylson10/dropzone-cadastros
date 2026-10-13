import {defineConfig,devices} from '@playwright/test'
export default defineConfig({testDir:'./tests-e2e',testMatch:'controlled/progression-atomic.spec.ts',workers:1,retries:0,timeout:45000,
 expect:{timeout:12000},outputDir:'relatorios-testes/progressao-transacao-2026-10-12/playwright-final-output',
 reporter:[['line'],['json',{outputFile:'relatorios-testes/progressao-transacao-2026-10-12/playwright-final-results.json'}]],
 use:{baseURL:'http://127.0.0.1:43198',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'progression-desktop',use:{...devices['Desktop Chrome']}},{name:'progression-mobile',use:{...devices['Pixel 7']}}]})
