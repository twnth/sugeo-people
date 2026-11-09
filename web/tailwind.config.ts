import type { Config } from 'tailwindcss'
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#19342d', leaf: '#267a58', cream: '#f7f7f1' } } }, plugins: [] } satisfies Config
