import { writeSidebar } from './lib/gen-sidebar-lib.mjs'

const docsDir = process.argv[2] || 'docs'
const target = writeSidebar(docsDir)
console.log(`sidebar written: ${target}`)
