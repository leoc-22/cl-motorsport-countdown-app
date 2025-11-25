import { useState, useEffect } from 'react'

export const useCountdownTimer = () => {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  return currentTime
}
