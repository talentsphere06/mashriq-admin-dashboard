
// 'use client'
// import { useRouter } from 'next/navigation'
// import React from 'react'
// import { useEffect } from 'react'

// const ProtectedRoute = ({children} : {children : React.ReactNode}) => {
//     const router = useRouter()

//     useEffect(() => {
//         const isLoggedIn = localStorage.getItem("isLoggedIn")
//         if(!isLoggedIn){
//             router.push("/admin")
//         }
//     }, [router])

//     return <>{children}</>
// }

// export default ProtectedRoute

'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) router.push('/admin')
  }, [router])

  return <>{children}</>
}

export default ProtectedRoute
