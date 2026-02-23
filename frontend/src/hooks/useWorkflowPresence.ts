import { useEffect, useState, useRef, useCallback } from 'react'
import { workflowApi, type PresenceUser } from '@/api/workflows'
import { useAuthStore } from '@/stores/authStore'

const HEARTBEAT_INTERVAL_MS = 15_000 // 15 saniye

/**
 * Workflow editördeki aktif kullanıcıları takip eder.
 * - Component mount'ta heartbeat başlatır
 * - Unmount'ta leave bildirir
 * - Diğer aktif kullanıcıları döner (kendisi hariç)
 */
export function useWorkflowPresence(workflowId: string) {
  const [otherUsers, setOtherUsers] = useState<PresenceUser[]>([])
  const currentUser = useAuthStore((s) => s.user)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = useCallback(async () => {
    try {
      const data = await workflowApi.presenceHeartbeat(workflowId)
      // Kendisi dışındaki kullanıcıları filtrele
      const others = data.active_users.filter(
        (u) => u.user_id !== currentUser?.id
      )
      setOtherUsers(others)
    } catch {
      // Sessizce geç — network hatası olursa next heartbeat tekrar dener
    }
  }, [workflowId, currentUser?.id])

  useEffect(() => {
    // İlk heartbeat hemen gönder
    sendHeartbeat()

    // Periyodik heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    // Cleanup: leave bildir + interval temizle
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Fire-and-forget leave isteği
      workflowApi.presenceLeave(workflowId).catch(() => {})
    }
  }, [workflowId, sendHeartbeat])

  return { otherUsers }
}
