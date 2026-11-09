import './globals.css'
export const metadata = { title: '옷함지도', description: '가까운 의류수거함 찾기' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html> }
