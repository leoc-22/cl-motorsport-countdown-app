import { useContext } from 'react'
import { CountdownContext } from '../utils/countdown-context'

export const useCountdown = () => {
  const context = useContext(CountdownContext)
  if (context === undefined) {
    throw new Error('useCountdown must be used within a CountdownProvider')
  }
  return context
}
