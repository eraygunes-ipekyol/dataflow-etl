import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/connections': 'Bağlantılar',
  '/workflows': 'Workflowlar',
  '/executions': 'Çalıştırmalar',
  '/schedules': 'Zamanlamalar',
  '/settings': 'Ayarlar',
}

export default function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'DataFlow ETL'

  return (
    <header className="flex h-14 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
    </header>
  )
}
