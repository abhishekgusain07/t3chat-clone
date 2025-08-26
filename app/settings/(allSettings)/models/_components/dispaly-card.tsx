// components/DataDisplayCard.tsx
import React from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
interface DataDisplayCardProps {
  title: string
  description: string
  dataCount: number
  dataLabel: string
  buttonText: string
  onButtonClick: () => void
  isLoading?: boolean
}

export const DataDisplayCard: React.FC<DataDisplayCardProps> = ({
  title,
  description,
  dataCount,
  dataLabel,
  buttonText,
  onButtonClick,
  isLoading = false,
}) => {
  return (
    <Card className="rounded-xl border-dashed">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {dataCount.toLocaleString()} {dataLabel}
          </p>
          <p className="text-xs">Updated 2 months ago</p>{' '}
          {/* Dummy update time */}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onButtonClick} disabled={isLoading} className="w-full">
          {isLoading ? 'Loading...' : buttonText}
        </Button>
      </CardFooter>
    </Card>
  )
}
