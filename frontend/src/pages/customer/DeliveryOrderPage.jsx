import { Navigate, useParams } from 'react-router-dom'

export default function DeliveryOrderPage() {
  const { restaurantId } = useParams()

  return (
    <Navigate
      to={`/delivery/restaurants/${restaurantId}`}
      replace
    />
  )
}