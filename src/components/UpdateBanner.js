import { useEffect, useState } from 'react'
import { subscribeToAppUpdate } from '../lib/pwaUpdateController'

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null)

  useEffect(() => {
    return subscribeToAppUpdate(setUpdate)
  }, [])

  if (!update) return null

  return (
    <div className="update-banner">
      <span className="update-banner__text">New version available</span>
      <button className="update-banner__reload" type="button" onClick={update.reload}>
        Reload
      </button>
    </div>
  )
}
