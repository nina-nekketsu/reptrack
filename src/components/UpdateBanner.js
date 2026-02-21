import { useEffect, useState } from 'react'
import { localBuildInfo } from '../utils/buildInfo'

export default function UpdateBanner() {
  const [stale, setStale] = useState(false)
  const hasBuildId = Boolean(localBuildInfo.buildId)

  useEffect(() => {
    if (!hasBuildId) return undefined

    const controller = new AbortController()
    const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '')
    const prefix = base ? `${base}` : ''
    const url = `${prefix}/build-info.json?ts=${Date.now()}`

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('no build info available')
        return res.json()
      })
      .then((remote) => {
        if (remote?.buildId && remote.buildId !== localBuildInfo.buildId) {
          setStale(true)
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [hasBuildId])

  if (!stale) return null

  return (
    <div className="update-banner">
      <span className="update-banner__text">New version available</span>
      <button className="update-banner__reload" type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}
